const ort = require("onnxruntime-node");
const sharp = require("sharp");
const { postprocess } = require("./postprocessing");

const MODEL_PATH = "./models/yolov8n.onnx";
const INPUT_SIZE = 640;
const CONF_THRESHOLD = 0.1;
const IOU_THRESHOLD = 0.5;
const CROWDED_THRESHOLD = 10;
const CLASSES = ["person", "undefined"];

let modelSession;

async function initializeModel() {
	if (!modelSession) {
		console.log("🧠 Loading model...");
		modelSession = await ort.InferenceSession.create(MODEL_PATH);
		console.log("✅ Model ready.");
	}
}

async function detectOvercrowding(imageBuffer, cctvCoverageArea) {
	await initializeModel();

	const { data, info } = await sharp(imageBuffer)
		.resize(INPUT_SIZE, INPUT_SIZE, { fit: "fill" })
		.raw()
		.toBuffer({ resolveWithObject: true });

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
	const inputName = modelSession.inputNames[0];
	const outputMap = await modelSession.run({ [inputName]: inputTensor });
	const output = outputMap[modelSession.outputNames[0]];

	const detections = postprocess(
		output,
		info.width,
		info.height,
		CLASSES,
		CONF_THRESHOLD
	);

	// Calculate total area covered by detected people
	let totalPersonArea = 0;
	const personDetections = detections.filter((d) => d.class_name === "person");

	personDetections.forEach((detection) => {
		// Extract coordinates from the box array [x1, y1, x2, y2]
		const [x1, y1, x2, y2] = detection.box;
		const boxWidth = x2 - x1;
		const boxHeight = y2 - y1;
		const boxArea = boxWidth * boxHeight;
		totalPersonArea += boxArea;
	});

	// Convert pixel area to real-world area proportion
	const imageArea = INPUT_SIZE * INPUT_SIZE; // 640x640 = 409,600 pixels
	const areaCoverageRatio = totalPersonArea / imageArea;

	// Calculate density in the real coverage area
	const occupiedRealArea = areaCoverageRatio * cctvCoverageArea; // in m²
	const densityPercentage = (occupiedRealArea / cctvCoverageArea) * 100;

	// Define density thresholds
	const DENSITY_THRESHOLD = 15; // 15% of area covered by people = overcrowded
	const isOvercrowded = densityPercentage > DENSITY_THRESHOLD;

	return {
		personCount: personDetections.length,
		totalPersonArea,
		areaCoverageRatio: areaCoverageRatio.toFixed(4),
		occupiedRealArea: occupiedRealArea.toFixed(2),
		densityPercentage: densityPercentage.toFixed(2),
		cctvCoverageArea,
		isOvercrowded,
		densityLevel: getDensityLevel(densityPercentage),
		detections: personDetections,
	};
}

function getDensityLevel(densityPercentage) {
	if (densityPercentage > 20) return "CRITICAL";
	if (densityPercentage > 15) return "HIGH";
	if (densityPercentage > 10) return "MODERATE";
	if (densityPercentage > 5) return "LOW";
	return "MINIMAL";
}

module.exports = { detectOvercrowding };
