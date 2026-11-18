// Airtime rewards: Nigerian mobile numbers and which network they belong to.
// The server checks the same rules (app/MamaputAirtime.php). A ported number
// keeps its old prefix, so the player can correct the network we guess.

export const NETWORKS = {
  mtn: "MTN",
  airtel: "Airtel",
  glo: "Glo",
  "9mobile": "9mobile",
};

// Longer prefixes are checked first (07025 and 07026 are MTN).
const PREFIXES = {
  mtn: [
    "07025",
    "07026",
    "0703",
    "0704",
    "0706",
    "0803",
    "0806",
    "0810",
    "0813",
    "0814",
    "0816",
    "0903",
    "0906",
    "0913",
    "0916",
  ],
  airtel: [
    "0701",
    "0708",
    "0802",
    "0808",
    "0812",
    "0901",
    "0902",
    "0904",
    "0907",
    "0911",
    "0912",
  ],
  glo: ["0705", "0805", "0807", "0811", "0815", "0905", "0915"],
  "9mobile": ["0809", "0817", "0818", "0908", "0909"],
};

// The level a player must reach to be in the airtime draw.
export const AIRTIME_LEVEL = 55;

// "0803 123 4567", "+234 803 123 4567" and "8031234567" all become
// "08031234567". Anything that is not a Nigerian mobile number is null.
export function normalizePhone(raw) {
  let d = String(raw || "").replace(/[\s\-().]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  if (d.startsWith("234")) d = "0" + d.slice(3);
  else if (/^[789]\d{9}$/.test(d)) d = "0" + d;
  return /^0[789][01]\d{8}$/.test(d) ? d : null;
}

// The network a number's prefix belongs to, or null if we cannot tell.
// Works on partial numbers too, so the guess appears while typing.
export function detectNetwork(raw) {
  let d = String(raw || "").replace(/[\s\-().]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  if (d.startsWith("234")) d = "0" + d.slice(3);
  else if (/^[789]/.test(d)) d = "0" + d;
  for (const len of [5, 4])
    for (const [net, list] of Object.entries(PREFIXES))
      if (list.some((p) => p.length === len && d.startsWith(p))) return net;
  return null;
}
