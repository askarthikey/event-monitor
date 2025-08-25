const sharp = require("sharp");
const ort = require("onnxruntime-node");

const INPUT_SIZE = 640; // default, can be dynamic

async function preprocess(imageBuffer) {
	// Resize to INPUT_SIZE x INPUT_SIZE and get raw RGB data (no alpha)
	const { data, info } = await sharp(imageBuffer)
		.resize(INPUT_SIZE, INPUT_SIZE, { fit: "fill" })
		.removeAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });

	// Normalize pixel values from [0, 255] to [0, 1]
	const floatArray = new Float32Array(data.length);
	for (let i = 0; i < data.length; i++) {
		floatArray[i] = data[i] / 255.0;
	}

	// Convert from HWC (interleaved RGB) to CHW format expected by ONNX
	const chwData = new Float32Array(3 * info.width * info.height);
	const width = info.width;
	const height = info.height;

	for (let i = 0; i < width * height; i++) {
		chwData[i] = floatArray[i * 3]; // R channel
		chwData[i + width * height] = floatArray[i * 3 + 1]; // G channel
		chwData[i + 2 * width * height] = floatArray[i * 3 + 2]; // B channel
	}

	// Create ONNX tensor with shape [1, 3, height, width]
	const inputTensor = new ort.Tensor("float32", chwData, [1, 3, height, width]);

	return {
		inputTensor,
		originalWidth: info.width,
		originalHeight: info.height,
	};
}

module.exports = {
	preprocess,
};
