import { makeReportId } from "./reportUtils";

// Keep these only so "Remove Demo Data" can clean up reports created by older app versions.
const LEGACY_DEMO_REPORT_TITLES = [
  "Water available at library",
  "Road blocked near main entrance",
  "First aid station at gym",
  "Charging station open at student center",
  "Dangerous flooding near parking lot",
  "Food distribution available at Dining Hall",
  "Food distribution available at Shelter Area",
  "Meals available at Dining Hall",
  "Meals available at Shelter Area",
  "Food supplies open at Dining Hall",
  "Food supplies open at Shelter Area",
  "Water available at Library",
  "Water available at Gym",
  "Water available at Shelter Area",
  "Water available at Dining Hall",
  "Water refill point open at Library",
  "Water refill point open at Gym",
  "Water refill point open at Shelter Area",
  "Water refill point open at Dining Hall",
  "Bottled water available at Library",
  "Bottled water available at Gym",
  "Bottled water available at Shelter Area",
  "Bottled water available at Dining Hall",
  "Charging station open at Student Center",
  "Charging station open at Dining Hall",
  "Power strips available at Student Center",
  "Power strips available at Dining Hall",
  "Device charging available at Student Center",
  "Device charging available at Dining Hall"
];

const DEMO_SCENARIOS = [
  {
    title: "Floodwater blocking main entrance",
    category: "Blocked Road",
    description:
      "Fast-moving water is covering both inbound lanes near the main entrance. Vehicles are turning around and responders need a clear alternate route.",
    urgency: "Critical",
    locationName: "Main Entrance",
    locationAddress: "1 Main Entrance Road, RescueMe Campus",
    latitude: 40.7122,
    longitude: -74.0082,
    minutesAgo: 12,
    photoEvidenceAttached: true
  },
  {
    title: "Evacuation assistance needed near library",
    category: "Need Help",
    description:
      "Several people are waiting near the library after losing elevator access. They need a welfare check and help moving to a safer area.",
    urgency: "High",
    locationName: "Library",
    locationAddress: "100 Library Walk, RescueMe Campus",
    latitude: 40.7136,
    longitude: -74.0052,
    minutesAgo: 18,
    photoEvidenceAttached: false
  },
  {
    title: "First aid triage active at gym",
    category: "First Aid",
    description:
      "A temporary triage table is handling minor injuries at the gym entrance. Supplies are limited and serious injuries should still be routed to emergency services.",
    urgency: "High",
    locationName: "Gym",
    locationAddress: "55 Athletics Drive, RescueMe Campus",
    latitude: 40.715,
    longitude: -74.0039,
    minutesAgo: 26,
    photoEvidenceAttached: true
  },
  {
    title: "Backup power needed at student center",
    category: "Charging",
    description:
      "The student center lost power and people are trying to charge phones, radios, and medical devices from a small backup battery station.",
    urgency: "Medium",
    locationName: "Student Center",
    locationAddress: "220 Student Center Plaza, RescueMe Campus",
    latitude: 40.7116,
    longitude: -74.0044,
    minutesAgo: 34,
    photoEvidenceAttached: false
  },
  {
    title: "Standing water hazard near parking lot 4",
    category: "Dangerous Area",
    description:
      "Water is pooling near parked vehicles and covering the curb line. Avoid walking through the area until it is checked for electrical and debris hazards.",
    urgency: "Critical",
    locationName: "Parking Lot 4",
    locationAddress: "400 West Parking Loop, RescueMe Campus",
    latitude: 40.7109,
    longitude: -74.0071,
    minutesAgo: 41,
    photoEvidenceAttached: true
  },
  {
    title: "Temporary shelter nearing capacity",
    category: "Shelter",
    description:
      "The shelter area is nearly full and needs crowd control support. Families are waiting outside and should be directed to overflow space if available.",
    urgency: "High",
    locationName: "Shelter Area",
    locationAddress: "75 Shelter Field Lane, RescueMe Campus",
    latitude: 40.713,
    longitude: -74.0015,
    minutesAgo: 49,
    photoEvidenceAttached: false
  },
  {
    title: "Potable water shortage at dining hall",
    category: "Water",
    description:
      "The dining hall is being used as a staging area, but clean water is running low. People should verify supply status before sending more evacuees there.",
    urgency: "High",
    locationName: "Dining Hall",
    locationAddress: "31 Dining Hall Court, RescueMe Campus",
    latitude: 40.7124,
    longitude: -74.0032,
    minutesAgo: 57,
    photoEvidenceAttached: false
  },
  {
    title: "Meal support needed for displaced families",
    category: "Food",
    description:
      "Families moved from the flooded area need shelf-stable meals and safe distribution support. This is a needs report, not a general cafeteria update.",
    urgency: "Medium",
    locationName: "Dining Hall",
    locationAddress: "31 Dining Hall Court, RescueMe Campus",
    latitude: 40.7124,
    longitude: -74.0032,
    minutesAgo: 63,
    photoEvidenceAttached: false
  },
  {
    title: "Medication refrigeration risk at health center",
    category: "General Update",
    description:
      "The health center is monitoring temperature-sensitive medication after a power interruption. Backup power or transfer support may be needed soon.",
    urgency: "High",
    locationName: "Health Center",
    locationAddress: "18 Wellness Way, RescueMe Campus",
    latitude: 40.7142,
    longitude: -74.0028,
    minutesAgo: 72,
    photoEvidenceAttached: false
  },
  {
    title: "Responder route update at police station",
    category: "General Update",
    description:
      "Responders are staging near the police station and redirecting traffic away from flooded streets. Keep access lanes clear for emergency vehicles.",
    urgency: "Medium",
    locationName: "Police Station",
    locationAddress: "12 Safety Road, RescueMe Campus",
    latitude: 40.7162,
    longitude: -74.0066,
    minutesAgo: 83,
    photoEvidenceAttached: false
  },
  {
    title: "Downed power line near west parking loop",
    category: "Dangerous Area",
    description:
      "A line is down near the west parking loop. Keep people away from standing water and do not touch vehicles or fences near the line.",
    urgency: "Critical",
    locationName: "Parking Lot 4",
    locationAddress: "400 West Parking Loop, RescueMe Campus",
    latitude: 40.7109,
    longitude: -74.0071,
    minutesAgo: 96,
    photoEvidenceAttached: true
  },
  {
    title: "Debris blocking ambulance access to health center",
    category: "Blocked Road",
    description:
      "Loose debris is blocking the closest vehicle approach to the health center. Ambulances need a cleared lane or a marked alternate path.",
    urgency: "High",
    locationName: "Health Center",
    locationAddress: "18 Wellness Way, RescueMe Campus",
    latitude: 40.7142,
    longitude: -74.0028,
    minutesAgo: 104,
    photoEvidenceAttached: true
  }
];

export const DEMO_REPORT_TITLES = [
  ...LEGACY_DEMO_REPORT_TITLES,
  ...DEMO_SCENARIOS.map((scenario) => scenario.title)
];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffled(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function jitter(value, amount = 0.00022) {
  return Number((value + (Math.random() * 2 - 1) * amount).toFixed(6));
}

export function makeDemoReports(deviceId) {
  const now = Date.now();
  const count = randomInt(6, DEMO_SCENARIOS.length);

  return shuffled(DEMO_SCENARIOS)
    .slice(0, count)
    .map((scenario) => ({
      report_id: makeReportId(deviceId),
      title: scenario.title,
      category: scenario.category,
      description: scenario.description,
      urgency: scenario.urgency,
      location_name: scenario.locationName,
      location_address: scenario.locationAddress,
      latitude: jitter(scenario.latitude),
      longitude: jitter(scenario.longitude),
      status: "Unverified",
      timestamp: new Date(now - scenario.minutesAgo * 60 * 1000).toISOString(),
      device_id: deviceId,
      photo_evidence_attached: scenario.photoEvidenceAttached,
      is_demo: true,
      confirmation_count: 0,
      confirmed_by_device_ids: [],
      sync_state: "pending"
    }));
}
