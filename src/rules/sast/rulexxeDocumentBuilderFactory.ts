import {
  createHardeningRule,
  extractFactoryReceiver
} from "./hardeningContext";


const factoryName = "DocumentBuilderFactory";

export const rule = createHardeningRule({
  id: "sast-xxe-document-builder-factory",
  description: "XML External Entity Injection: DocumentBuilderFactory.newInstance() without secure configuration",
  severity: "high",
  triggerPattern: /\bDocumentBuilderFactory\s*\.\s*newInstance\s*\(/,
  extractReceiver: (line) => extractFactoryReceiver(line, factoryName),
  hardeningChecks: (receiver) => {
    const scoped = receiver ? `\\b${receiver}\\s*\\.` : "\\.";
    return [
      new RegExp(`${scoped}setExpandEntityReferences\\s*\\(\\s*false\\s*\\)`),
      new RegExp(`${scoped}setFeature\\s*\\([^)]*disallow-doctype-decl`, "i")
    ];
  },
  message:
    "[SAST] XXE: after DocumentBuilderFactory.newInstance(), configure setFeature with disallow-doctype-decl and setExpandEntityReferences(false)."
});
