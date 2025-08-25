// utils.js
const CONF_THRESHOLD = 0.7;
const IOU_THRESHOLD = 0.5;// Customize per model if needed

function calculateIoU(box1, box2) {
	const [x1, y1, x2, y2] = box1;
	const [x3, y3, x4, y4] = box2;
	const xi1 = Math.max(x1, x3);
	const yi1 = Math.max(y1, y3);
	const xi2 = Math.min(x2, x4);
	const yi2 = Math.min(y2, y4);
	const inter = Math.max(0, xi2 - xi1) * Math.max(0, yi2 - yi1);
	const union = (x2 - x1) * (y2 - y1) + (x4 - x3) * (y4 - y3) - inter;
	return inter / union;
}

function nonMaxSuppression(boxes, scores, threshold = IOU_THRESHOLD) {
	let order = scores
		.map((s, i) => [s, i])
		.sort((a, b) => b[0] - a[0])
		.map(([_, i]) => i);
	const selected = [];

	while (order.length) {
		const i = order.shift();
		selected.push(i);
		order = order.filter((j) => calculateIoU(boxes[i], boxes[j]) < threshold);
	}

	return selected;
}

// postprocess function expects output tensor and original image sizes
function postprocess(
	output,
	originalWidth,
	originalHeight,
	classes,
   confThreshold=CONF_THRESHOLD
) {
	const data = output.data;
	const [batch, channels, boxes] = output.dims;

	const transposed = new Float32Array(data.length);
	for (let i = 0; i < boxes; i++) {
		for (let j = 0; j < channels; j++) {
			transposed[i * channels + j] = data[j * boxes + i];
		}
	}

	const detections = [];
	for (let i = 0; i < boxes; i++) {
		const row = transposed.slice(i * channels, (i + 1) * channels);
		const conf = Math.max(...row.slice(4));
		if (conf > confThreshold) {
			const classId = row.slice(4).indexOf(conf);
			const [cx, cy, w, h] = row.slice(0, 4);

			const x1 = (cx - w / 2) * (originalWidth / 640);
			const y1 = (cy - h / 2) * (originalHeight / 640);
			const x2 = (cx + w / 2) * (originalWidth / 640);
			const y2 = (cy + h / 2) * (originalHeight / 640);

			detections.push({
				box: [x1, y1, x2, y2],
				score: conf,
				class_name: classes[classId],
			});
		}
	}

	const indices = nonMaxSuppression(
		detections.map((d) => d.box),
		detections.map((d) => d.score),
		IOU_THRESHOLD
	);
	return indices.map((i) => detections[i]);
}

module.exports = {
	postprocess,
};