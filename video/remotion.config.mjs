import { Config } from "@remotion/cli/config";

// H.264 in an MP4 plays inline everywhere, including iOS Safari — which matters
// because this sits on a landing page most people open on a phone.
Config.setVideoImageFormat("jpeg");
Config.setCodec("h264");
Config.setOverwriteOutput(true);
Config.setEntryPoint("src/index.jsx");
