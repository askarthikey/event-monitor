const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

class GeminiService {
	constructor() {
		if (!process.env.GEMINI_API_KEY) {
			console.warn("⚠️  GEMINI_API_KEY not found in environment variables");
			this.genAI = null;
		} else {
			this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
		}
	}

	async generateCCTVAnalysisSummary(cctvData) {
		if (!this.genAI) {
			return {
				summary: "AI analysis unavailable - Gemini API key not configured",
				logs: "Unable to generate detailed logs without AI service",
			};
		}

		try {
			const model = this.genAI.getGenerativeModel({
				model: "gemini-1.5-flash",
			});

			// Prepare the prompt with the CCTV data
			const prompt = `
You are an AI safety analyst for event monitoring systems. Analyze the following CCTV processing results and generate:

1. A SUMMARY (2-3 sentences): Basic overview of the analysis results
2. LOGS (detailed timeline): What happened during the monitoring period, focusing on significant events

CCTV Data:
- CCTV ID: ${cctvData.cctvId}
- Total Frames Processed: ${cctvData.summary.totalFrames}
- Processing Time: ${cctvData.processedAt}
- Coverage Area: ${cctvData.cctvMetadata?.coverageArea || "Unknown"}

Safety Statistics:
- Fire Detection: ${cctvData.summary.fireDetectedFrames}/${
				cctvData.summary.totalFrames
			} frames (${cctvData.summary.overallFireRisk})
- Average People per Frame: ${cctvData.summary.averagePeoplePerFrame}
- Overcrowding Events: ${
				cctvData.summary.crowdSafety?.overcrowdedFrames || 0
			} frames
- Unconscious Persons Detected: ${
				cctvData.summary.unconsciousSafety?.framesWithUnconsciousPersons || 0
			} frames
- Stampede Events: ${
				cctvData.summary.stampedeSafety?.stampedeDetectedFrames || 0
			} frames
- Overall Risk Level: ${
				cctvData.summary.overallSafety?.overallRiskLevel || "LOW"
			}

Sample Frame Analysis (first 5 frames):
${cctvData.detailedResults
	.slice(0, 5)
	.map(
		(frame, index) => `
Frame ${index + 1} (${frame.timestamp}s):
- Fire: ${frame.fireDetection?.fireDetected ? "DETECTED" : "Safe"} (${
			frame.fireDetection?.intensity || 0
		})
- People Count: ${frame.crowdDetection?.personCount || 0}
- Density: ${frame.crowdDetection?.densityPercentage || 0}% (${
			frame.crowdDetection?.densityLevel || "LOW"
		})
- Unconscious: ${frame.unconsciousDetection?.unconsciousCount || 0}
- Stampede Risk: ${frame.stampedeDetection?.riskLevel || "LOW"}
- Overall Risk: ${frame.overallRisk?.level || "LOW"}
`
	)
	.join("")}

Instructions:
1. SUMMARY: Write a brief 2-3 sentence overview of the monitoring session
2. LOGS: Create a timeline of significant events. If no major incidents occurred, write "No significant safety issues detected during monitoring period. All frames showed normal activity levels."

Format your response as:
SUMMARY:
[Your summary here]

LOGS:
[Your detailed logs here]
`;

			const result = await model.generateContent(prompt);
			const response = await result.response;
			const text = response.text();

			// Parse the response to extract summary and logs
			const summaryMatch = text.match(/SUMMARY:\s*([\s\S]*?)(?=LOGS:|$)/i);
			const logsMatch = text.match(/LOGS:\s*([\s\S]*?)$/i);

			const summary = summaryMatch
				? summaryMatch[1].trim()
				: "Analysis completed successfully.";
			const logs = logsMatch
				? logsMatch[1].trim()
				: "No detailed logs available.";

			return {
				summary,
				logs,
				generatedAt: new Date().toISOString(),
				model: "gemini-1.5-flash",
			};
		} catch (error) {
			console.error("Error generating Gemini analysis:", error);

			// Fallback summary generation
			const { summary: data } = cctvData;
			const hasIssues =
				data.fireDetectedFrames > 0 ||
				(data.crowdSafety?.overcrowdedFrames || 0) > 0 ||
				(data.unconsciousSafety?.framesWithUnconsciousPersons || 0) > 0 ||
				(data.stampedeSafety?.stampedeDetectedFrames || 0) > 0;

			const fallbackSummary = hasIssues
				? `Processed ${data.totalFrames} frames with ${
						data.fireDetectedFrames
				  } fire detections, ${
						data.crowdSafety?.overcrowdedFrames || 0
				  } overcrowding events, and overall ${
						data.overallSafety?.overallRiskLevel || "LOW"
				  } risk level.`
				: `Successfully processed ${
						data.totalFrames
				  } frames showing normal activity levels with average ${
						data.averagePeoplePerFrame
				  } people per frame and ${
						data.overallSafety?.overallRiskLevel || "LOW"
				  } risk level.`;

			const fallbackLogs = hasIssues
				? `Monitoring detected ${data.fireDetectedFrames} fire incidents, ${
						data.crowdSafety?.overcrowdedFrames || 0
				  } overcrowding events, ${
						data.unconsciousSafety?.framesWithUnconsciousPersons || 0
				  } unconscious person detections, and ${
						data.stampedeSafety?.stampedeDetectedFrames || 0
				  } stampede risks during the analysis period.`
				: "No significant safety issues detected during monitoring period. All frames showed normal activity levels with no fire, overcrowding, or emergency incidents reported.";

			return {
				summary: fallbackSummary,
				logs: fallbackLogs,
				generatedAt: new Date().toISOString(),
				model: "fallback-generator",
				error: "Gemini API unavailable, using fallback generation",
			};
		}
	}
}

module.exports = GeminiService;
