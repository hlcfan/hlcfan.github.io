import { FORTUNES } from "../fs.js";

export default {
  name: "fortune",
  desc: "print a random line",
  run: () => ({ out: FORTUNES[Math.floor(Math.random() * FORTUNES.length)] }),
};
