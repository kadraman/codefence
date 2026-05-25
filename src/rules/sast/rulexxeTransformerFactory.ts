import {
  createHardeningRule,
  extractFactoryReceiver
} from "./hardeningContext";


const factoryName = "TransformerFactory";

export const rule = createHardeningRule({
  id: "sast-xxe-transformer-factory",
  description: "XML External Entity Injection: TransformerFactory without secure processing feature",
  severity: "high",
  triggerPattern: /\bTransformerFactory\s*\.\s*newInstance\s*\(/,
  extractReceiver: (line) => extractFactoryReceiver(line, factoryName),
  hardeningChecks: (receiver) => {
    const scoped = receiver ? `\\b${receiver}\\s*\\.` : "\\.";
    return [
      new RegExp(`${scoped}setFeature\\s*\\([^)]*FEATURE_SECURE_PROCESSING`, "i"),
      new RegExp(`${scoped}setFeature\\s*\\([^)]*secure-processing`, "i")
    ];
  },
  message:
    "[SAST] XXE: call setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true) after TransformerFactory.newInstance()."
});
