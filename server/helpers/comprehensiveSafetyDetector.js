const { detectOvercrowding } = require("./overCrowddetection");
const { detectUnconsciousPersons } = require("./unconsciousDetection");
const { SimpleStampedeDetector } = require("./stampedeDetection");

class ComprehensiveSafetyDetector {
	constructor() {
		this.stampedeDetector = new SimpleStampedeDetector();
	}

	async detectAllThreats(imageBuffer, cctvCoverageArea) {
		// Get regular crowd detection
		const crowdResult = await detectOvercrowding(imageBuffer, cctvCoverageArea);

		// Get unconscious detection
		const unconsciousResult = await detectUnconsciousPersons(imageBuffer);

		// Add stampede detection using crowd detections
		const stampedeResult = this.stampedeDetector.detectStampede(
			crowdResult.detections
		);

		// Combined risk analysis
		const combinedRisk = this.analyzeOverallRisk(
			crowdResult,
			unconsciousResult,
			stampedeResult
		);

		return {
			// Individual detection results
			crowd: {
				personCount: crowdResult.personCount,
				isOvercrowded: crowdResult.isOvercrowded,
				densityPercentage: parseFloat(crowdResult.densityPercentage),
				densityLevel: crowdResult.densityLevel,
				areaCoverageRatio: parseFloat(crowdResult.areaCoverageRatio),
				occupiedRealArea: parseFloat(crowdResult.occupiedRealArea),
				cctvCoverageArea: crowdResult.cctvCoverageArea,
				totalPersonArea: crowdResult.totalPersonArea,
				detections: crowdResult.detections.length,
			},
			unconscious: {
				unconsciousCount: unconsciousResult.unconsciousCount,
				totalPersons: unconsciousResult.totalPersons,
				overallRisk: unconsciousResult.overallRisk,
				alertLevel: unconsciousResult.alertLevel,
				unconsciousPersons: unconsciousResult.unconsciousPersons.map((p) => ({
					personId: p.personId,
					poseType: p.poseType,
					riskLevel: p.riskLevel,
					unconsciousScore: parseFloat(p.unconsciousScore.toFixed(4)),
					reasons: p.reasons,
				})),
				emergencyAlerts: unconsciousResult.emergencyAlerts,
			},
			stampede: {
				isStampede: stampedeResult.isStampede,
				stampedeScore: stampedeResult.stampedeScore,
				riskLevel: stampedeResult.riskLevel,
				reasons: stampedeResult.reasons,
				alertLevel: stampedeResult.alertLevel,
				movementStats: stampedeResult.movementStats,
				temporalPattern: stampedeResult.temporalPattern,
			},
			// Overall risk assessment
			overallRisk: combinedRisk,
			// Emergency priority
			emergencyPriority: this.getEmergencyPriority(
				crowdResult,
				unconsciousResult,
				stampedeResult
			),
		};
	}

	analyzeOverallRisk(crowdResult, unconsciousResult, stampedeResult) {
		const threats = [];
		let maxRiskLevel = "SAFE";

		// Analyze individual threats
		if (stampedeResult.isStampede) {
			threats.push({
				type: "STAMPEDE",
				severity: stampedeResult.riskLevel,
				description: "Dangerous crowd movement patterns detected",
				score: stampedeResult.stampedeScore,
			});
			maxRiskLevel = this.getHigherRisk(maxRiskLevel, "CRITICAL");
		}

		if (unconsciousResult.unconsciousCount > 0) {
			threats.push({
				type: "UNCONSCIOUS_PERSON",
				severity: unconsciousResult.alertLevel,
				description: `${unconsciousResult.unconsciousCount} unconscious person(s) detected`,
				score: 0.9, // High severity for unconscious persons
			});
			maxRiskLevel = this.getHigherRisk(maxRiskLevel, "HIGH");
		}

		if (crowdResult.isOvercrowded) {
			threats.push({
				type: "OVERCROWDING",
				severity: crowdResult.densityLevel,
				description: `Overcrowded area: ${crowdResult.densityPercentage}% density`,
				score: parseFloat(crowdResult.densityPercentage) / 100,
			});
			maxRiskLevel = this.getHigherRisk(maxRiskLevel, crowdResult.densityLevel);
		}

		// Determine combined threat level
		let combinedThreatLevel = "SAFE";
		let immediateAction = "CONTINUE_MONITORING";
		let description = "Normal conditions detected";

		if (threats.length === 0) {
			combinedThreatLevel = "SAFE";
		} else if (threats.length === 1) {
			combinedThreatLevel = maxRiskLevel;
			description = threats[0].description;
		} else {
			// Multiple threats - escalate response
			combinedThreatLevel = "CRITICAL";
			description = `Multiple threats detected: ${threats
				.map((t) => t.type)
				.join(", ")}`;
		}

		// Determine immediate action
		if (stampedeResult.isStampede && crowdResult.isOvercrowded) {
			immediateAction = "EMERGENCY_EVACUATION_REQUIRED";
			combinedThreatLevel = "CRITICAL";
			description = "CRITICAL: Stampede in overcrowded area";
		} else if (stampedeResult.isStampede) {
			immediateAction = "CROWD_CONTROL_REQUIRED";
		} else if (unconsciousResult.unconsciousCount > 0) {
			immediateAction = "MEDICAL_ASSISTANCE_REQUIRED";
		} else if (crowdResult.isOvercrowded) {
			immediateAction = "MONITOR_CLOSELY_MANAGE_CROWD";
		}

		return {
			level: combinedThreatLevel,
			description: description,
			immediateAction: immediateAction,
			threats: threats,
			riskScore:
				threats.length > 0 ? Math.max(...threats.map((t) => t.score)) : 0,
		};
	}

	getEmergencyPriority(crowdResult, unconsciousResult, stampedeResult) {
		// Priority 1: CRITICAL - Multiple life-threatening conditions
		if (stampedeResult.isStampede && unconsciousResult.unconsciousCount > 0) {
			return {
				level: 1,
				classification: "CRITICAL_EMERGENCY",
				description:
					"Stampede with unconscious persons - Multiple casualties likely",
				responseTime: "IMMEDIATE",
			};
		}

		// Priority 2: HIGH - Single life-threatening condition
		if (stampedeResult.isStampede && crowdResult.densityPercentage > 25) {
			return {
				level: 2,
				classification: "HIGH_EMERGENCY",
				description: "Stampede in high-density crowd - High casualty risk",
				responseTime: "IMMEDIATE",
			};
		}

		// Priority 3: MEDIUM - Unconscious person or stampede in moderate crowd
		if (unconsciousResult.unconsciousCount > 0 || stampedeResult.isStampede) {
			return {
				level: 3,
				classification: "MEDIUM_EMERGENCY",
				description:
					unconsciousResult.unconsciousCount > 0
						? "Medical emergency detected"
						: "Crowd movement emergency",
				responseTime: "URGENT",
			};
		}

		// Priority 4: LOW - Overcrowding only
		if (crowdResult.isOvercrowded) {
			return {
				level: 4,
				classification: "LOW_PRIORITY",
				description: "Overcrowding detected - Monitor for escalation",
				responseTime: "STANDARD",
			};
		}

		// Priority 5: NORMAL - No threats
		return {
			level: 5,
			classification: "NORMAL",
			description: "No immediate threats detected",
			responseTime: "ROUTINE",
		};
	}

	getHigherRisk(current, new_risk) {
		const riskLevels = [
			"SAFE",
			"MINIMAL",
			"LOW",
			"MODERATE",
			"MEDIUM",
			"HIGH",
			"CRITICAL",
		];
		const currentIndex = riskLevels.indexOf(current);
		const newIndex = riskLevels.indexOf(new_risk);
		return riskLevels[Math.max(currentIndex, newIndex)];
	}

	// Reset all detectors (useful for new video processing)
	reset() {
		this.stampedeDetector.reset();
	}
}

module.exports = { ComprehensiveSafetyDetector };
