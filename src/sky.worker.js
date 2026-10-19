import { buildNebula } from "./nebula.js";
self.onmessage = ({ data }) => {
  try {
    const result = buildNebula(data.seed);
    self.postMessage(result, [result.base.buffer, result.clouds.buffer]);
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
