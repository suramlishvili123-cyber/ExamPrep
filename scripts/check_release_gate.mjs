const requirements = [
  ["CONTENT_RIGHTS_CONFIRMED", "written redistribution permission or qualified legal clearance"],
  ["PRIVACY_NOTICE_COMPLETE", "the real operator identity/contact and final privacy notice"],
  ["AUTHENTICATED_A11Y_REVIEW_COMPLETE", "authenticated keyboard and screen-reader review"],
];

const missing = requirements
  .filter(([name]) => process.env[name] !== "true")
  .map(([name, description]) => `${name}=true (${description})`);

if (missing.length) {
  console.error("Production deployment is blocked until these repository variables are set after evidence is recorded:");
  for (const requirement of missing) console.error(`- ${requirement}`);
  process.exitCode = 1;
} else {
  console.log("External production release attestations are present.");
}
