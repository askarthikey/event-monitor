const ort = require("onnxruntime-node");
const path = require("path");
const { postprocess } = require("./postprocessing");
const sharp = require("sharp");
const CLASSES = ["fire", "smoke"];
const CONF_THRESHOLD = 0.25;
const IOU_THRESHOLD = 0.45;

const modelPath = path.resolve(__dirname, "../models/fire.onnx");

let session;

async function initModel() {
	if (!session) {
		session = await ort.InferenceSession.create(modelPath);
		console.log("🔥 Fire model loaded.");
	}
}

async function detectFire(inputTensor, originalWidth, originalHeight) {
	await initModel();

	const inputName = session.inputNames[0];
	const outputMap = await session.run({ [inputName]: inputTensor });

	const output = outputMap[session.outputNames[0]];
	const detections = postprocess(
		output,
		originalWidth,
		originalHeight,
		CLASSES,
		CONF_THRESHOLD
	);
	return detections;
}

async function detectFireIntensity(inputTensor, originalHeight, originalWidth) {
	const detections = await detectFire(
		inputTensor,
		originalHeight,
		originalWidth
	);
	let firePixelArea = 0;
	for (const det of detections) {
		if (det.class_name === "fire") {
			const [x1, y1, x2, y2] = det.box;
			firePixelArea += (x2 - x1) * (y2 - y1);
		}
	}
	const framePixelArea = originalWidth * originalHeight;
	const intensity = firePixelArea / framePixelArea;
	const fireDetected = intensity > 0.1;
	return { intensity, fireDetected };
}

module.exports = { detectFireIntensity };
