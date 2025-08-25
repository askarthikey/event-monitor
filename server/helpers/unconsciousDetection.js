const ort = require("onnxruntime-node");
const sharp = require("sharp");

// Use YOLOv11 pose model for unconscious detection
const POSE_MODEL_PATH = "./models/yolo11n-pose.onnx";
const INPUT_SIZE = 640;
const CONF_THRESHOLD = 0.6; // Higher confidence to reduce false positives

const IOU_THRESHOLD = 0.3; // More aggressive NMS

// YOLOv11 pose keypoints (17 keypoints same as YOLOv8)
const KEYPOINTS = {
	NOSE: 0,
	LEFT_EYE: 1,
	RIGHT_EYE: 2,
	LEFT_EAR: 3,
	RIGHT_EAR: 4,
	LEFT_SHOULDER: 5,
	RIGHT_SHOULDER: 6,
	LEFT_ELBOW: 7,
	RIGHT_ELBOW: 8,
	LEFT_WRIST: 9,
	RIGHT_WRIST: 10,
	LEFT_HIP: 11,
	RIGHT_HIP: 12,
	LEFT_KNEE: 13,
	RIGHT_KNEE: 14,
	LEFT_ANKLE: 15,
	RIGHT_ANKLE: 16,
};

let poseModelSession;

async function initializePoseModel() {
	if (!poseModelSession) {
		console.log("🧠 Loading YOLOv11 pose model...");
		poseModelSession = await ort.InferenceSession.create(POSE_MODEL_PATH);
		console.log("✅ YOLOv11 pose model ready for unconscious detection.");
	}
}

async function detectUnconsciousPersons(imageBuffer) {
	await initializePoseModel();

	const { data, info } = await sharp(imageBuffer)
		.resize(INPUT_SIZE, INPUT_SIZE, { fit: "fill" })
		.raw()
		.toBuffer({ resolveWithObject: true });

	// Preprocess image (same as other detections)
	const floatData = new Float32Array(data.length);
	for (let i = 0; i < data.length; i++) {
		floatData[i] = data[i] / 255.0;
	}

	const chw = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE);
	for (let i = 0; i < INPUT_SIZE * INPUT_SIZE; i++) {
		chw[i] = floatData[i * 3];
		chw[i + INPUT_SIZE * INPUT_SIZE] = floatData[i * 3 + 1];
		chw[i + 2 * INPUT_SIZE * INPUT_SIZE] = floatData[i * 3 + 2];
	}

	const inputTensor = new ort.Tensor("float32", chw, [
		1,
		3,
		INPUT_SIZE,
		INPUT_SIZE,
	]);
	const inputName = poseModelSession.inputNames[0];
	const outputMap = await poseModelSession.run({ [inputName]: inputTensor });
	const output = outputMap[poseModelSession.outputNames[0]];

	// Process pose detections
	const poseDetections = processPoseOutput(output, info.width, info.height);

	console.log(
		`   📊 Detected ${poseDetections.length} valid poses with keypoints`
	);

	const unconsciousPersons = [];

	poseDetections.forEach((detection, index) => {
		const analysis = analyzePoseForUnconsciousness(detection.keypoints);

		if (analysis.isUnconsciousLikely) {
			unconsciousPersons.push({
				personId: index,
				bbox: detection.bbox,
				confidence: detection.confidence,
				unconsciousScore: analysis.score,
				poseType: analysis.poseType,
				riskLevel: analysis.riskLevel,
				reasons: analysis.reasons,
			});
		}
	});

	// Sort by unconscious score and take only the most confident one per frame
	unconsciousPersons.sort((a, b) => b.unconsciousScore - a.unconsciousScore);
	const topUnconsciousPersons = unconsciousPersons.slice(0, 1); // Take only the top 1

	return {
		totalPersons: poseDetections.length,
		unconsciousCount: topUnconsciousPersons.length,
		unconsciousPersons: topUnconsciousPersons,
		overallRisk: topUnconsciousPersons.length > 0 ? "EMERGENCY" : "SAFE",
		alertLevel: getAlertLevel(topUnconsciousPersons.length),
		emergencyAlerts: topUnconsciousPersons.map((p) => ({
			type: "UNCONSCIOUS_PERSON_DETECTED",
			severity: p.riskLevel,
			confidence: p.unconsciousScore,
			poseType: p.poseType,
			reasons: p.reasons,
			bbox: p.bbox,
		})),
	};
}

function processPoseOutput(output, originalWidth, originalHeight) {
	const detections = [];
	const data = output.data;
	const dimensions = output.dims;

	// YOLOv11 pose output format: [batch, num_detections, 56]
	// 56 = 4 (bbox) + 1 (conf) + 51 (17 keypoints * 3)
	const batchSize = dimensions[0];
	const numDetections = dimensions[1];
	const featuresPerDetection = dimensions[2]; // Should be 56

	for (let i = 0; i < numDetections; i++) {
		const baseIndex = i * featuresPerDetection;

		// Extract bbox and confidence
		const x1 = data[baseIndex + 0];
		const y1 = data[baseIndex + 1];
		const x2 = data[baseIndex + 2];
		const y2 = data[baseIndex + 3];
		const confidence = data[baseIndex + 4];

		// Only process high-confidence detections with valid bbox
		if (confidence > CONF_THRESHOLD && x2 > x1 && y2 > y1) {
			// Extract keypoints (17 keypoints * 3 values each = 51 values)
			const keypoints = [];
			let validKeypointsCount = 0;

			for (let j = 0; j < 17; j++) {
				const keypointStartIndex = baseIndex + 5 + j * 3;
				const kx = data[keypointStartIndex];
				const ky = data[keypointStartIndex + 1];
				const kconf = data[keypointStartIndex + 2];

				keypoints.push([kx, ky, kconf]);

				// Count valid keypoints
				if (kconf > 0.3) {
					validKeypointsCount++;
				}
			}

			// Only include detections with enough valid keypoints
			if (validKeypointsCount >= 5) {
				detections.push({
					bbox: [x1, y1, x2, y2],
					confidence: confidence,
					keypoints: keypoints,
				});
			}
		}
	}

	// Apply Non-Maximum Suppression to remove duplicates
	return applyNMS(detections);
}

function applyNMS(detections) {
	if (detections.length === 0) return detections;

	// Sort by confidence (highest first)
	detections.sort((a, b) => b.confidence - a.confidence);

	const keep = [];
	const suppressed = new Set();

	for (let i = 0; i < detections.length; i++) {
		if (suppressed.has(i)) continue;

		keep.push(detections[i]);

		for (let j = i + 1; j < detections.length; j++) {
			if (suppressed.has(j)) continue;

			const iou = calculateIoU(detections[i].bbox, detections[j].bbox);
			if (iou > IOU_THRESHOLD) {
				suppressed.add(j);
			}
		}
	}

	return keep;
}

function calculateIoU(box1, box2) {
	const [x1_1, y1_1, x2_1, y2_1] = box1;
	const [x1_2, y1_2, x2_2, y2_2] = box2;

	// Calculate intersection area
	const x1 = Math.max(x1_1, x1_2);
	const y1 = Math.max(y1_1, y1_2);
	const x2 = Math.min(x2_1, x2_2);
	const y2 = Math.min(y2_1, y2_2);

	if (x2 <= x1 || y2 <= y1) return 0;

	const intersection = (x2 - x1) * (y2 - y1);
	const area1 = (x2_1 - x1_1) * (y2_1 - y1_1);
	const area2 = (x2_2 - x1_2) * (y2_2 - y1_2);
	const union = area1 + area2 - intersection;

	return intersection / union;
}

function analyzePoseForUnconsciousness(keypoints) {
	const analysis = {
		isUnconsciousLikely: false,
		score: 0,
		reasons: [],
		poseType: "STANDING",
		riskLevel: "LOW",
	};

	// Get key body points
	const nose = keypoints[KEYPOINTS.NOSE];
	const leftShoulder = keypoints[KEYPOINTS.LEFT_SHOULDER];
	const rightShoulder = keypoints[KEYPOINTS.RIGHT_SHOULDER];
	const leftHip = keypoints[KEYPOINTS.LEFT_HIP];
	const rightHip = keypoints[KEYPOINTS.RIGHT_HIP];
	const leftAnkle = keypoints[KEYPOINTS.LEFT_ANKLE];
	const rightAnkle = keypoints[KEYPOINTS.RIGHT_ANKLE];

	// Calculate average positions (if keypoints are visible)
	const avgShoulder = getAveragePoint([leftShoulder, rightShoulder]);
	const avgHip = getAveragePoint([leftHip, rightHip]);
	const avgAnkle = getAveragePoint([leftAnkle, rightAnkle]);

	// 1. Check for horizontal body position (lying down)
	if (avgShoulder && avgHip && avgAnkle) {
		const bodyLength = Math.abs(avgShoulder[0] - avgAnkle[0]); // Horizontal distance
		const bodyHeight = Math.abs(avgShoulder[1] - avgAnkle[1]); // Vertical distance

		// If body is more horizontal than vertical
		if (bodyLength > bodyHeight * 1.5) {
			analysis.score += 0.6;
			analysis.reasons.push("HORIZONTAL_BODY_POSITION");
			analysis.poseType = "LYING_DOWN";
		}
	}

	// 2. Check if head is lower than hips (collapsed)
	if (nose && nose[2] > 0.3 && avgHip) {
		// nose visible with good confidence
		if (nose[1] > avgHip[1]) {
			// Head Y > Hip Y (head below hips)
			analysis.score += 0.5;
			analysis.reasons.push("HEAD_BELOW_HIPS");
			analysis.poseType = "COLLAPSED";
		}
	}

	// 3. Check for unnatural limb positions
	const limbAnalysis = analyzeUnnaturalLimbPositions(keypoints);
	if (limbAnalysis.isUnnatural) {
		analysis.score += 0.3;
		analysis.reasons.push("UNNATURAL_LIMB_POSITION");
	}

	// 4. Check if person is completely flat (all major points at similar Y level)
	if (nose && avgShoulder && avgHip && avgAnkle) {
		const yPositions = [nose[1], avgShoulder[1], avgHip[1], avgAnkle[1]];
		const maxY = Math.max(...yPositions);
		const minY = Math.min(...yPositions);
		const yVariance = maxY - minY;

		if (yVariance < 50) {
			// Very small Y variance = flat position
			analysis.score += 0.4;
			analysis.reasons.push("COMPLETELY_FLAT_POSITION");
			analysis.poseType = "FLAT_ON_GROUND";
		}
	}

	// Determine final assessment
	analysis.isUnconsciousLikely = analysis.score > 0.8; // More strict threshold

	if (analysis.score > 0.9) {
		analysis.riskLevel = "CRITICAL";
	} else if (analysis.score > 0.8) {
		analysis.riskLevel = "HIGH";
	} else if (analysis.score > 0.6) {
		analysis.riskLevel = "MEDIUM";
	}

	return analysis;
}

function analyzeUnnaturalLimbPositions(keypoints) {
	// Check for twisted or unnatural arm/leg positions
	let unnaturalCount = 0;

	// Check if limbs are in impossible positions (simplified check)
	const leftElbow = keypoints[KEYPOINTS.LEFT_ELBOW];
	const rightElbow = keypoints[KEYPOINTS.RIGHT_ELBOW];
	const leftKnee = keypoints[KEYPOINTS.LEFT_KNEE];
	const rightKnee = keypoints[KEYPOINTS.RIGHT_KNEE];
	const leftShoulder = keypoints[KEYPOINTS.LEFT_SHOULDER];
	const rightShoulder = keypoints[KEYPOINTS.RIGHT_SHOULDER];

	// Check for arms in unusual positions
	if (
		leftElbow &&
		leftShoulder &&
		leftElbow[2] > 0.3 &&
		leftShoulder[2] > 0.3
	) {
		// If elbow is significantly higher than shoulder (arm twisted up)
		if (leftElbow[1] < leftShoulder[1] - 30) {
			unnaturalCount++;
		}
	}

	if (
		rightElbow &&
		rightShoulder &&
		rightElbow[2] > 0.3 &&
		rightShoulder[2] > 0.3
	) {
		if (rightElbow[1] < rightShoulder[1] - 30) {
			unnaturalCount++;
		}
	}

	return { isUnnatural: unnaturalCount > 0 };
}

function getAveragePoint(points) {
	const validPoints = points.filter((p) => p && p[2] > 0.3); // Filter by confidence
	if (validPoints.length === 0) return null;

	const avgX =
		validPoints.reduce((sum, p) => sum + p[0], 0) / validPoints.length;
	const avgY =
		validPoints.reduce((sum, p) => sum + p[1], 0) / validPoints.length;
	const avgConf =
		validPoints.reduce((sum, p) => sum + p[2], 0) / validPoints.length;

	return [avgX, avgY, avgConf];
}

function getAlertLevel(unconsciousCount) {
	if (unconsciousCount >= 3) return "CRITICAL";
	if (unconsciousCount >= 2) return "HIGH";
	if (unconsciousCount >= 1) return "MEDIUM";
	return "LOW";
}

module.exports = { detectUnconsciousPersons };
