import clc from "cli-color";

const colorErr = clc.red.bold;
const colorWarn = clc.yellow;
const colorInfo = clc.blue;
const colorSuccess = clc.green;
const colorUpdate = clc.bgYellow;

export { colorErr, colorInfo, colorSuccess, colorUpdate, colorWarn };
export default clc;
