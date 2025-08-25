class SimpleStampedeDetector {
	constructor() {
		this.previousDetections = [];
		this.movementHistory = [];
		this.STAMPEDE_THRESHOLD = 0.6;
		this.HIGH_MOVEMENT_THRESHOLD = 50; // pixels
		this.HISTORY_SIZE = 5; // frames to analyze
	}

	detectStampede(currentDetections) {
		if (this.previousDetections.length === 0) {
			this.previousDetections = currentDetections;
			return this.createSafeResult();
		}

		// Calculate movement of detected persons
		const movements = this.calculateMovements(
			this.previousDetections,
			currentDetections
		);
		const stampedeAnalysis = this.analyzeMovements(
			movements,
			currentDetections.length
		);

		// Add to movement history
		this.movementHistory.push(stampedeAnalysis);
		if (this.movementHistory.length > this.HISTORY_SIZE) {
			this.movementHistory.shift();
		}

		// Temporal analysis for sustained movement
		const temporalAnalysis = this.analyzeTemporalPattern();

		// Combine instant and temporal analysis
		const finalScore = this.combinedAnalysis(
			stampedeAnalysis,
			temporalAnalysis
		);

		this.previousDetections = currentDetections;

		return {
			isStampede: finalScore.score > this.STAMPEDE_THRESHOLD,
			stampedeScore: parseFloat(finalScore.score.toFixed(3)),
			riskLevel: this.getRiskLevel(finalScore.score),
			reasons: finalScore.reasons,
			alertLevel:
				finalScore.score > this.STAMPEDE_THRESHOLD ? "CRITICAL" : "SAFE",
			movementStats: {
				totalMovements: movements.length,
				averageMovement:
					movements.length > 0
						? (movements.reduce((a, b) => a + b, 0) / movements.length).toFixed(
								2
						  )
						: 0,
				highMovementCount: movements.filter(
					(m) => m > this.HIGH_MOVEMENT_THRESHOLD
				).length,
				personCount: currentDetections.length,
			},
			temporalPattern: temporalAnalysis,
		};
	}

	calculateMovements(prevDetections, currDetections) {
		const movements = [];

		// Simple distance-based matching between frames
		currDetections.forEach((currPerson) => {
			const closest = this.findClosestPerson(currPerson, prevDetections);
			if (closest) {
				const distance = this.calculateDistance(currPerson.box, closest.box);
				movements.push(distance);
			}
		});

		return movements;
	}

	findClosestPerson(targetPerson, detections) {
		let closest = null;
		let minDistance = Infinity;

		detections.forEach((person) => {
			const distance = this.calculateDistance(targetPerson.box, person.box);
			if (distance < minDistance && distance < 200) {
				// Max reasonable movement between frames
				minDistance = distance;
				closest = person;
			}
		});

		return closest;
	}

	calculateDistance(box1, box2) {
		// Calculate center points
		const center1 = [(box1[0] + box1[2]) / 2, (box1[1] + box1[3]) / 2];
		const center2 = [(box2[0] + box2[2]) / 2, (box2[1] + box2[3]) / 2];

		// Euclidean distance
		return Math.sqrt(
			Math.pow(center1[0] - center2[0], 2) +
				Math.pow(center1[1] - center2[1], 2)
		);
	}

	analyzeMovements(movements, personCount) {
		if (movements.length === 0) {
			return { score: 0, reasons: [], avgMovement: 0, highMovementRatio: 0 };
		}

		const avgMovement = movements.reduce((a, b) => a + b, 0) / movements.length;
		const highMovementCount = movements.filter(
			(m) => m > this.HIGH_MOVEMENT_THRESHOLD
		).length;
		const highMovementRatio = highMovementCount / movements.length;

		let score = 0;
		const reasons = [];

		// High average movement indicates panic/stampede
		if (avgMovement > 80) {
			score += 0.4;
			reasons.push("EXTREMELY_HIGH_MOVEMENT");
		} else if (avgMovement > 50) {
			score += 0.3;
			reasons.push("HIGH_AVERAGE_MOVEMENT");
		} else if (avgMovement > 30) {
			score += 0.2;
			reasons.push("MODERATE_MOVEMENT");
		}

		// High ratio of people moving quickly
		if (highMovementRatio > 0.7) {
			score += 0.4;
			reasons.push("MAJORITY_RAPID_MOVEMENT");
		} else if (highMovementRatio > 0.5) {
			score += 0.3;
			reasons.push("SIGNIFICANT_RAPID_MOVEMENT");
		} else if (highMovementRatio > 0.3) {
			score += 0.2;
			reasons.push("SOME_RAPID_MOVEMENT");
		}

		// Large crowd with movement is more dangerous
		if (personCount > 10 && avgMovement > 30) {
			score += 0.2;
			reasons.push("LARGE_CROWD_WITH_MOVEMENT");
		}

		return { score, reasons, avgMovement, highMovementRatio };
	}

	analyzeTemporalPattern() {
		if (this.movementHistory.length < 3) {
			return { sustainedMovement: false, trend: "INSUFFICIENT_DATA" };
		}

		const recentScores = this.movementHistory.slice(-3).map((h) => h.score);
		const avgRecentScore =
			recentScores.reduce((a, b) => a + b, 0) / recentScores.length;

		// Check if movement is increasing (panic spreading)
		const isIncreasing =
			recentScores[2] > recentScores[1] && recentScores[1] > recentScores[0];
		const isDecreasing =
			recentScores[2] < recentScores[1] && recentScores[1] < recentScores[0];

		// Sustained high movement
		const sustainedMovement = recentScores.every((score) => score > 0.3);

		let trend = "STABLE";
		if (isIncreasing) trend = "ESCALATING";
		else if (isDecreasing) trend = "CALMING";
		else if (sustainedMovement) trend = "SUSTAINED_HIGH";

		return {
			sustainedMovement,
			trend,
			avgRecentScore: parseFloat(avgRecentScore.toFixed(3)),
			isEscalating: isIncreasing,
			isCalming: isDecreasing,
		};
	}

	combinedAnalysis(instantAnalysis, temporalAnalysis) {
		let finalScore = instantAnalysis.score;
		const reasons = [...instantAnalysis.reasons];

		// Boost score if movement is escalating
		if (temporalAnalysis.isEscalating) {
			finalScore += 0.2;
			reasons.push("ESCALATING_MOVEMENT_PATTERN");
		}

		// Boost score if sustained high movement
		if (temporalAnalysis.sustainedMovement) {
			finalScore += 0.15;
			reasons.push("SUSTAINED_HIGH_MOVEMENT");
		}

		// Reduce score if movement is calming down
		if (temporalAnalysis.isCalming) {
			finalScore = Math.max(0, finalScore - 0.1);
			reasons.push("MOVEMENT_CALMING_DOWN");
		}

		// Cap the score at 1.0
		finalScore = Math.min(1.0, finalScore);

		return { score: finalScore, reasons };
	}

	getRiskLevel(score) {
		if (score > 0.8) return "CRITICAL";
		if (score > 0.6) return "HIGH";
		if (score > 0.4) return "MEDIUM";
		if (score > 0.2) return "LOW";
		return "MINIMAL";
	}

	createSafeResult() {
		return {
			isStampede: false,
			stampedeScore: 0,
			riskLevel: "MINIMAL",
			reasons: [],
			alertLevel: "SAFE",
			movementStats: {
				totalMovements: 0,
				averageMovement: 0,
				highMovementCount: 0,
				personCount: 0,
			},
			temporalPattern: {
				sustainedMovement: false,
				trend: "NO_DATA",
			},
		};
	}

	// Reset detector state (useful for new video processing)
	reset() {
		this.previousDetections = [];
		this.movementHistory = [];
	}
}

module.exports = { SimpleStampedeDetector };
