// Build-owned EBS destination. Replace this exact origin before a Hosted Test upload.
// Never source this value from the Viewer Path, query string, localStorage, or viewer input.
window.ChatXptExtensionEnvironment = Object.freeze({
  ebsOrigin: "https://localhost:3000",
});
