import type { Difficulty, Question } from "@/lib/types";

type Seed = [
  courseId: string,
  text: string,
  options: [string, string, string, string],
  correct: number,
  difficulty: Difficulty,
  explanation: string,
];

const FIRE = "crs_fire";
const MAINT = "crs_maint";
const FIRST = "crs_first";
const SITE = "crs_site";
const ELEC = "crs_elec";
const HEIGHT = "crs_height";
const CHEM = "crs_chem";
const DRIVE = "crs_drive";

const seeds: Seed[] = [
  /* ── Fire Safety Level 1 (20) ─────────────────────────────────── */
  [
    FIRE,
    "A fire is sustained by which combination of elements?",
    [
      "Heat, oxygen and fuel",
      "Heat, smoke and oxygen",
      "Fuel, oxygen and carbon dioxide",
      "Heat, fuel and nitrogen",
    ],
    0,
    1,
    "The fire tetrahedron is heat, oxygen, fuel and a sustaining chemical chain. Removing any one of the three will suppress the fire.",
  ],
  [
    FIRE,
    "Which class of fire involves flammable liquids such as diesel or paint?",
    ["Class A", "Class B", "Class C", "Class D"],
    1,
    1,
    "Class B covers flammable liquids. Water must never be used — it spreads the fuel.",
  ],
  [
    FIRE,
    "Which extinguisher is most appropriate for cooking oil and deep fryer fires?",
    ["Water", "CO₂", "Wet chemical (Class K/F)", "Dry powder"],
    2,
    2,
    "Wet chemical is specifically formulated to saponify fats and cool burning oil. Water causes violent spattering.",
  ],
  [
    FIRE,
    "A CO₂ extinguisher works primarily by which mechanism?",
    [
      "Cooling below the ignition temperature",
      "Smothering by displacing oxygen",
      "Removing the fuel source",
      "Interrupting the chemical chain",
    ],
    1,
    2,
    "CO₂ is non-conductive and leaves no residue, ideal for electrical and server rooms. It does not cool much, so re-ignition is possible.",
  ],
  [
    FIRE,
    "When is a fire blanket appropriate?",
    [
      "For a person whose clothing is on fire",
      "For smothering a chip-pan fire",
      "For cooling a cylinder valve",
      "For extinguishing a Class A fire in an open bin",
    ],
    0,
    1,
    "A fire blanket smothers flames on a person and reduces oxygen to the burning clothing. It does not cool, so seek medical attention afterwards.",
  ],
  [
    FIRE,
    "What is the correct sequence when discovering a fire?",
    [
      "Fight it, then alert others",
      "Raise the alarm, then evacuate, then call the brigade",
      "Evacuate silently, then call the brigade",
      "Call the brigade, then search for the source",
    ],
    1,
    1,
    "Alert first so others begin evacuating, get out yourself, then call the fire brigade from a safe location.",
  ],
  [
    FIRE,
    "The assembly point during an evacuation should be located where?",
    [
      "In the car park so lifts are not blocked",
      "Upwind and away from the building, clear of the assembly point of another zone",
      "Next to the fire exit for quick re-entry",
      "Inside the lobby for head count",
    ],
    1,
    2,
    "Assembly points must be upwind, clear of the building and of other zones, and reachable without crossing the fire appliance route.",
  ],
  [
    FIRE,
    "Which class of fire is produced by burning magnesium?",
    ["Class A", "Class B", "Class C", "Class D"],
    3,
    3,
    "Class D involves combustible metals such as magnesium, sodium and titanium. Water is dangerous — it can intensify the reaction.",
  ],
  [
    FIRE,
    "Before using a portable fire extinguisher you should always first:",
    [
      "Test it by squeezing the handle",
      "Check the safety pin is sealed and stand with your back to a clear escape route",
      "Remove the pin fully before selecting the extinguisher",
      "Invert the cylinder to check it is full",
    ],
    1,
    1,
    "Only fight a fire if it is small, you are trained, you have the right extinguisher and you have a clear escape route behind you.",
  ],
  [
    FIRE,
    "PASS in fire extinguisher training stands for:",
    [
      "Pull, Aim, Squeeze, Sweep",
      "Point, Alert, Spray, Stop",
      "Pull, Alert, Spray, Save",
      "Press, Aim, Spray, Spray",
    ],
    0,
    1,
    "Pull the pin, Aim the nozzle at the base of the fire, Squeeze the handle, Sweep side to side.",
  ],
  [
    FIRE,
    "A fire door should be kept:",
    [
      "Wedged open for ventilation during working hours",
      "Closed and unobstructed at all times",
      "Locked only after hours",
      "Open during drills and closed otherwise",
    ],
    1,
    1,
    "Fire doors compartmentalise smoke and heat. Wedging them open defeats the whole system.",
  ],
  [
    FIRE,
    "Smoke is primarily dangerous because it:",
    [
      "Is extremely hot at the source of ignition",
      "Displaces oxygen and obscures escape routes",
      "Makes metal tools conduct electricity",
      "Spreads fire faster than open flame",
    ],
    1,
    2,
    "Toxic smoke displaces oxygen and blocks visibility, which is why crawl-low evacuation is taught.",
  ],
  [
    FIRE,
    "Hot work such as welding or cutting requires:",
    [
      "A fire watch for at least 30 minutes after completion",
      "A signed hot work permit and an in-place fire watch",
      "Approval from the site general manager only",
      "Dry extinguishers kept out of reach",
    ],
    1,
    2,
    "A permit plus a dedicated fire watch for at least 30 minutes after work stops is the standard control for hot work.",
  ],
  [
    FIRE,
    "Which of these is a Class C fire?",
    [
      "Burning paper and textiles",
      "Burning petrol in a generator",
      "A live electrical circuit",
      "Burning cooking oil",
    ],
    2,
    2,
    "Class C is fire involving electrical equipment. Use CO₂, dry powder or an aqueous film-forming agent — never plain water.",
  ],
  [
    FIRE,
    "How often should emergency exit signage be tested?",
    [
      "Once a year",
      "Monthly, as part of the routine walk-round",
      "Only after an incident",
      "At the annual fire audit",
    ],
    1,
    2,
    "Monthly walk-round testing catches failed lamps, blocked routes and missing signs long before a real evacuation.",
  ],
  [
    FIRE,
    "An employee discovers fire in a server room with no extinguisher in reach. The correct action is:",
    [
      "Find the nearest extinguisher first",
      "Raise the alarm, evacuate, close the door behind you and call the brigade",
      "Open the server door to cut power",
      "Use the corridor extinguisher on the server",
    ],
    1,
    2,
    "No extinguisher and no training means evacuate. Closing the door contains the smoke for the brigade.",
  ],
  [
    FIRE,
    "The extinguisher most suitable for a waste-bin fire in a general office is:",
    ["Water", "CO₂", "Wet chemical", "Dry powder"],
    0,
    1,
    "A waste bin holds ordinary combustibles — Class A. A water extinguisher is correct; CO₂ and powder are unnecessary and messy.",
  ],
  [
    FIRE,
    "Which factor makes a space more vulnerable to flashover?",
    [
      "Low ceiling height with a high heat load",
      "High ceiling height with good ventilation",
      "Non-combustible wall linings",
      "Automatic sprinkler coverage",
    ],
    0,
    3,
    "Flashover risk rises when hot gases layer under a low ceiling and the heat release rate outstrips cooling.",
  ],
  [
    FIRE,
    "In a fire evacuation, stairwells should be used instead of lifts because:",
    [
      "Stairs are always faster",
      "Lifts can fail, open on a fire floor or are recalled to the lobby",
      "Stairs have better lighting",
      "Lifts are reserved for visitors",
    ],
    1,
    1,
    "A lift may open its doors on a fire floor, lose power, or be recalled. Stairs are the designed means of escape.",
  ],
  [
    FIRE,
    "The most common cause of workplace fire in East African sites is:",
    [
      "Lightning strike",
      "Electrical faults and poor wiring",
      "Arson",
      "Flooding",
    ],
    1,
    2,
    "Overloaded distribution boards, damaged cables and uncertified fittings dominate incident records.",
  ],

  /* ── Mechanical Maintenance Safety (8) ────────────────────────── */
  [
    MAINT,
    "Before any maintenance on a motorised machine you must first:",
    [
      "Remove the fuse only",
      "Apply lockout/tagout: isolate, lock, tag and prove the energy is dead",
      "Switch the machine to auto mode",
      "Notify the operator by email",
    ],
    1,
    1,
    "LOTO is the single most important control: identify all energy sources, isolate, lock and tag, then verify zero energy.",
  ],
  [
    MAINT,
    "Which energy source is most commonly missed during isolation?",
    [
      "Electrical mains",
      "Stored hydraulic or pneumatic pressure",
      "Battery supply",
      "Solar panels",
    ],
    1,
    3,
    "Residual hydraulic, pneumatic, spring and gravitational energy remain after the isolator is off. Always bleed and block.",
  ],
  [
    MAINT,
    "A fixed guard is preferable to a personal guard because it:",
    [
      "Is cheaper to replace",
      "Cannot be removed or defeated by the operator",
      "Allows faster production",
      "Looks better at audit",
    ],
    1,
    2,
    "Fixed guards should require tools to remove. Interlocked guards are the next best control where frequent access is needed.",
  ],
  [
    MAINT,
    "Before operating a pneumatic tool you should always:",
    [
      "Check the air line connections and whip check them",
      "Increase the line pressure",
      "Blow the line clear at full pressure first",
      "Wear ear defenders only",
    ],
    0,
    2,
    "Whip checks stop a hose whipping if it fails at the fitting. A stored-energy line must be bled down before connecting.",
  ],
  [
    MAINT,
    "Grease nipples should never be touched with:",
    [
      "A clean rag",
      "Compressed air at close range",
      "A grease gun",
      "Gloves",
    ],
    1,
    3,
    "High-pressure air injection injury occurs when grease is forced under the skin. Use a low-pressure, controlled method.",
  ],
  [
    MAINT,
    "The safest way to check a lifting sling before use is:",
    [
      "Stretch it to full length",
      "Visual inspection of tags, webbing, stitching and any cuts",
      "Load it to 110% of the rated capacity",
      "Soak it in water overnight",
    ],
    1,
    1,
    "Pre-use checks are visual. Any cut, fraying, heat damage or missing tag means quarantine the sling immediately.",
  ],
  [
    MAINT,
    "Which of the following is a permit-required confined space?",
    [
      "A walk-in cold store under 6 m³",
      "A drained water tank entered through a manway",
      "An open warehouse aisle",
      "A parked van",
    ],
    1,
    2,
    "Atmospheric hazards, restricted entry and the rescue requirement are what make a tank a permit-required confined space.",
  ],
  [
    MAINT,
    "Machinery should only be run while a person is:",
    [
      "On site but out of sight",
      "Stationed at the controls and able to stop it instantly",
      "Holding a radio",
      "Present only for the first two minutes",
    ],
    1,
    1,
    "Nobody should be in the danger zone while a machine runs. If a test run is needed, the operator stays at the controls.",
  ],

  /* ── First Aid & CPR (8) ─────────────────────────────────────── */
  [
    FIRST,
    "What is the first action at any accident scene?",
    [
      "Begin CPR immediately",
      "Check the scene is safe before approaching",
      "Move the casualty to a clear area",
      "Call the family",
    ],
    1,
    1,
    "Scene safety comes first. A live cable or traffic hazard makes you the second casualty otherwise.",
  ],
  [
    FIRST,
    "How many rescue breaths and compressions are given in adult CPR?",
    [
      "1 breath to 5 compressions",
      "2 breaths to 30 compressions",
      "2 breaths to 15 compressions",
      "1 breath to 15 compressions",
    ],
    1,
    1,
    "Adult CPR is 30 compressions to 2 breaths at a rate of 100–120 compressions per minute.",
  ],
  [
    FIRST,
    "The compression depth for an adult is approximately:",
    ["2 cm", "3–4 cm", "5–6 cm", "8 cm"],
    2,
    2,
    "Adult compressions are 5–6 cm deep, with the chest fully recoiling between compressions.",
  ],
  [
    FIRST,
    "The recovery position is used for an unconscious casualty who is:",
    [
      "Not breathing normally and needs CPR",
      "Breathing normally but is unconscious",
      "Bleeding heavily from a limb",
      "Having a seizure",
    ],
    1,
    1,
    "Recovery position keeps the airway open in a breathing unconscious casualty. If breathing stops, start CPR immediately.",
  ],
  [
    FIRST,
    "Which is the correct order of the primary survey?",
    [
      "Breathing, airway, circulation",
      "Airway, breathing, circulation",
      "Circulation, airway, breathing",
      "Disability, airway, breathing",
    ],
    1,
    1,
    "ABCDE: Airway with cervical protection, Breathing, Circulation, Disability, Exposure.",
  ],
  [
    FIRST,
    "For a severe external bleed you should apply:",
    [
      "A small adhesive plaster",
      "Direct pressure, then a pressure dressing if it soaks through",
      "An ice pack only",
      "A tourniquet as the first step",
    ],
    1,
    2,
    "Direct pressure is first. A tourniquet is a last resort for life-threatening limb bleeding when pressure dressing fails.",
  ],
  [
    FIRST,
    "A casualty suspected of spinal injury should be:",
    [
      "Moved immediately to a clear area",
      "Kept still, with manual in-line stabilisation and the head held neutral",
      "Sat upright against a wall",
      "Given water to drink",
    ],
    1,
    2,
    "Minimise movement and hold the head in line until the ambulance service takes over. Do not straighten a bent limb.",
  ],
  [
    FIRST,
    "Burns from a chemical splash should be:",
    [
      "Treated with butter or grease",
      "Copiously irrigated with clean running water for at least 20 minutes",
      "Wrapped tightly in cling film straight away",
      "Treated with an ice pack",
    ],
    1,
    2,
    "Irrigate immediately and for at least 20 minutes. Neutralise only if the substance is specifically known to require it.",
  ],

  /* ── Site Security & Access Control (8) ─────────────────────── */
  [
    SITE,
    "Every visitor on site must be:",
    [
      "Escorted or tracked by a visitor badge",
      "Allowed to walk unaccompanied after 10 minutes",
      "Signed in only during office hours",
      "Carrying a radio",
    ],
    0,
    1,
    "Escort or tracking means the security team always knows who is on site and where.",
  ],
  [
    SITE,
    "A visitor badge must be returned when the visitor:",
    [
      "Enters the canteen",
      "Leaves the site or at badge expiry, whichever is first",
      "Goes for a smoke break",
      "Signs out of the induction",
    ],
    1,
    2,
    "Badges are surrendered on exit and automatically expire. A lost badge is a site-wide security event.",
  ],
  [
    SITE,
    "Tailgating is best described as:",
    [
      "A vehicle following too closely",
      "A person following an authorised person through a controlled door",
      "A late arrival",
      "A radio handover",
    ],
    1,
    2,
    "Tailgating defeats the badge system. Challenge it politely and report every occurrence.",
  ],
  [
    SITE,
    "Which entry should be recorded in the access log?",
    [
      "Only visitors",
      "Every entry and exit, with name, badge, time and gate",
      "Only unescorted visitors",
      "Only entries after 18:00",
    ],
    1,
    1,
    "A complete log gives the investigation trail in the event of theft, trespass or an injury.",
  ],
  [
    SITE,
    "A fire alarm sounds during a patrol. Your first action is to:",
    [
      "Continue the patrol to completion",
      "Report to the control room and proceed to the assembly point area for the zone",
      "Investigate the source alone",
      "Open the nearest fire door",
    ],
    1,
    2,
    "Report, then evacuate to your zone's assembly point. Guards assist roll call but do not re-enter to investigate.",
  ],
  [
    SITE,
    "CCTV footage is normally retained for:",
    [
      "24 hours",
      "A period defined by the site security policy, typically 31 days",
      "Until the next audit",
      "One week",
    ],
    1,
    2,
    "Retention periods are set by policy and data-protection law, and footage is only preserved for an incident when flagged.",
  ],
  [
    SITE,
    "Which statement about issuing a challenge is correct?",
    [
      "Only security supervisors may challenge",
      "Every guard should challenge, using the agreed polite protocol, from a safe distance",
      "Challenges should be logged only if the person refuses",
      "Challenges are discouraged to avoid conflict",
    ],
    1,
    1,
    "The whole team challenges. A consistent, scripted protocol reduces conflict and creates evidence of intent.",
  ],
  [
    SITE,
    "Keys for restricted areas must be stored:",
    [
      "In a vehicle glovebox",
      "In a secured key cabinet with a signed register",
      "Under a desk mat",
      "Shared verbally between shift teams",
    ],
    1,
    1,
    "Secured storage plus a signature register is what makes key issue auditable and loss detectable.",
  ],

  /* ── Electrical Safety (8) ───────────────────────────────────── */
  [
    ELEC,
    "Before working on an electrical circuit you must:",
    [
      "Switch off at the board only",
      "Isolate, lock off, prove dead, and earth where required",
      "Put a warning sign on the door",
      "Tell a colleague verbally",
    ],
    1,
    1,
    "Proving dead with an approved voltage indicator is the step that actually protects you, not the lock itself.",
  ],
  [
    ELEC,
    "Which instrument is used to prove a circuit is dead?",
    [
      "A non-contact pen only",
      "An approved two-pole voltage indicator, proved before and after on a known source",
      "A general-purpose multimeter without proving units",
      "A clamp meter",
    ],
    1,
    2,
    "A single-pole device can fail. Prove the tester on a known live source before and after your test.",
  ],
  [
    ELEC,
    "Arc flash PPE is principally required to protect against:",
    [
      "Chemical burns",
      "Thermal burns and molten metal from an arc event",
      "Radiation",
      "Noise",
    ],
    1,
    2,
    "An arc flash reaches several thousand kelvin instantly. Face shield, arc-rated clothing and insulated gloves are essential.",
  ],
  [
    ELEC,
    "A residual current device (RCD) protects against:",
    [
      "Overload only",
      "Earth leakage and shock, by tripping when current returns to ground",
      "Surge voltage",
      "Motor stalling",
    ],
    1,
    1,
    "An RCD compares current out and current back. Any imbalance indicates current through a person or to earth.",
  ],
  [
    ELEC,
    "Cables should never be run across a walkway because:",
    [
      "They use more power",
      "They become a trip hazard and are easily damaged",
      "They cannot be tested",
      "They interfere with radio signals",
    ],
    1,
    1,
    "Overfloor and overhead routing is the norm. Use cable ramps and covers where crossing is unavoidable.",
  ],
  [
    ELEC,
    "A portable appliance with a damaged lead should be:",
    [
      "Taped and returned to service",
      "Withdrawn from use and tagged until repaired or replaced",
      "Used with reduced duty cycle",
      "Given to a different user",
    ],
    1,
    1,
    "Damaged leads are the fourth common cause of site electrocution. Tag it out — do not tape it.",
  ],
  [
    ELEC,
    "Static electricity is best controlled by:",
    [
      "Wearing cotton only",
      "Earthing and bonding, plus anti-static footwear and clothing",
      "Using plastic tools",
      "Increasing humidity to 90%",
    ],
    1,
    2,
    "Bonding equalises potential so no discharge occurs; anti-static PPE stops charge building in the first place.",
  ],
  [
    ELEC,
    "A generator should be earthed before it is:",
    [
      "Refuelled",
      "Connected to the installation and energised",
      "Moved",
      "Serviced",
    ],
    1,
    2,
    "Earthing the generator and the site installation together prevents dangerous transferred potentials.",
  ],

  /* ── Working at Height (8) ───────────────────────────────────── */
  [
    HEIGHT,
    "Which control is strongest in the hierarchy of fall prevention?",
    [
      "Harness and lanyard",
      "Elimination of the need to work at height",
      "Warning signage",
      "Supervisor observation",
    ],
    1,
    2,
    "PPE is the last line. Plan the task so the work is done at ground level wherever that is reasonably practicable.",
  ],
  [
    HEIGHT,
    "Full-body harness inspection before use should be done:",
    [
      "Weekly by the user",
      "Before every use by the wearer, with a documented periodic inspection",
      "Only after a fall",
      "At purchase",
    ],
    1,
    1,
    "Pre-use check by the wearer, plus a recorded thorough inspection by a competent person on a fixed schedule.",
  ],
  [
    HEIGHT,
    "The main purpose of a scaffold tag is to show:",
    [
      "The scaffold company name",
      "Whether the scaffold is complete, safe to use, and when it was last inspected",
      "The number of workers allowed",
      "The permit holder",
    ],
    1,
    1,
    "Green = ready for use, red = incomplete, purple = scaffold altered and needs re-inspection. Handover and inspection must be recorded.",
  ],
  [
    HEIGHT,
    "A good scaffold working platform should be:",
    [
      "Two boards wide with no gap over 25 mm and a guardrail at 950 mm",
      "One board wide with no gaps",
      "Any surface tested to 5 kN",
      "Bolted steel with edge protection only",
    ],
    0,
    3,
    "Boards should be 225 mm (2 boards), gaps under 25 mm, plus toe boards and mid rails to prevent objects falling.",
  ],
  [
    HEIGHT,
    "A ladder should be secured at the top when:",
    [
      "It is painted metal",
      "It provides access to a working platform or roof edge",
      "It is used in a corridor",
      "It has a cage fitted",
    ],
    1,
    2,
    "A securing point near the top stops the ladder sliding at the point where the climber transfers onto the platform.",
  ],
  [
    HEIGHT,
    "A rescue plan after a fall must include:",
    [
      "Waiting for the emergency service to arrive",
      "A means of prompt rescue, ideally within minutes, with trained rescuers",
      "Lowering on a rope only",
      "Drinking water and resting",
    ],
    1,
    2,
    "Suspension trauma can be fatal within minutes. A rescue plan and trained team are non-negotiable before working at height.",
  ],
  [
    HEIGHT,
    "A roof-edge protection system without personal fall arrest should provide:",
    [
      "Railings at 450 mm only",
      "Top rail at 950 mm with mid rail, toe board and a rigid anchorage rated to the standard",
      "A warning rope at 1.1 m",
      "A guardrail at 1.5 m",
    ],
    1,
    3,
    "Collective protection is preferred: 950 mm top rail, mid rail, 150 mm toe board, and anchorage that resists the load without relying on the post alone.",
  ],
  [
    HEIGHT,
    "Anchor points used for personal fall arrest must be:",
    [
      "Any visible steelwork",
      "Certified, rated, inspected and of a defined position relative to the user",
      "Handrails",
      "Scaffold tubes only",
    ],
    1,
    2,
    "Anchors must be certified, positioned high, arrest within 6 m and be capable of holding 6 kN per attached user.",
  ],

  /* ── Hazardous Chemicals & COSHH (8) ─────────────────────────── */
  [
    CHEM,
    "A safety data sheet is consulted mainly to understand:",
    [
      "The supplier's pricing",
      "Hazards, exposure controls, handling and first aid measures",
      "The product colour",
      "Delivery schedules",
    ],
    1,
    1,
    "SDS sections 1–11 cover identification, hazards, composition, first aid, fire fighting, handling and exposure controls.",
  ],
  [
    CHEM,
    "The two routes by which chemicals enter the body are:",
    [
      "Inhalation and skin contact only",
      "Inhalation, ingestion and skin absorption",
      "Inhalation and ingestion only",
      "Skin contact and eye splash only",
    ],
    1,
    2,
    "Inhalation is the most dangerous, but dermal absorption and hand-to-mouth transfer account for a large share of cases.",
  ],
  [
    CHEM,
    "An oxidising agent must never be stored with:",
    [
      "Other oxidising agents",
      "Flammable and combustible materials",
      "Water",
      "Empty containers",
    ],
    1,
    2,
    "Oxidisers intensify fire. Segregate them in a dedicated cabinet away from flammables and reducing agents.",
  ],
  [
    CHEM,
    "Which control is most effective against chemical vapour exposure?",
    [
      "Respiratory protection",
      "Local exhaust ventilation at the point of use",
      "Signage",
      "Shorter shifts",
    ],
    1,
    2,
    "LEV captures the contaminant at source and is the primary control; respiratory protection supplements it.",
  ],
  [
    CHEM,
    "When decanting a corrosive liquid you should:",
    [
      "Wear no gloves for grip",
      "Wear splash goggles, face shield and acid/alkali resistant gloves, and use a funnel tray",
      "Lean the container to pour faster",
      "Work in a closed container",
    ],
    1,
    2,
    "Corrosives cause severe eye damage. Splash protection, a compatible funnel and a secondary containment tray are minimum practice.",
  ],
  [
    CHEM,
    "Safety shower and eyewash stations should be:",
    [
      "Checked weekly and flushed monthly",
      "Unobstructed, clearly signed, reachable within 10 seconds and tested regularly",
      "Locked to prevent misuse",
      "Located near the canteen",
    ],
    1,
    1,
    "A blocked or slow station is worse than none. Test the flow and confirm the path is clear at every shift change.",
  ],
  [
    CHEM,
    "A spill kit should contain:",
    [
      "Absorbent granules, pads, boots, gloves, goggles and a sealable container",
      "A mop and bucket",
      "Sawdust only",
      "Fire extinguishers",
    ],
    0,
    1,
    "A complete kit lets an untrained first responder contain a small spill without improvising or exposing themselves.",
  ],
  [
    CHEM,
    "Which statement about chemical containers is correct?",
    [
      "Decant into a drink bottle to save space",
      "Keep in the original labelled container or a properly labelled compatible one",
      "Relabel with the product name only",
      "Store in a sealed drink bottle with a lid",
    ],
    1,
    1,
    "Misdecanting into drinks containers has caused fatal poisonings. Original labels carry the hazard and first aid information.",
  ],

  /* ── Safe Driving & Fleet Safety (8) ─────────────────────────── */
  [
    DRIVE,
    "Defensive driving primarily means:",
    [
      "Driving as fast as safely possible",
      "Anticipating hazards and leaving a safe margin at all times",
      "Keeping the radio off",
      "Following the shortest route",
    ],
    1,
    1,
    "Defensive driving is about positioning, speed choice and following distance so you can avoid rather than react.",
  ],
  [
    DRIVE,
    "A pre-trip vehicle inspection should always be:",
    [
      "Optional on short routes",
      "Recorded, covering tyres, lights, brakes, leaks and load security",
      "Performed only when the vehicle is serviced",
      "Done by the mechanic",
    ],
    1,
    1,
    "A recorded pre-trip check is the last barrier against a roadside failure and is legally required in most jurisdictions.",
  ],
  [
    DRIVE,
    "The recommended minimum following distance in good dry conditions is:",
    [
      "One second",
      "At least two seconds (four seconds in poor conditions)",
      "Half a vehicle length",
      "Ten metres, always",
    ],
    1,
    2,
    "Two seconds gives reaction and braking distance; double it in rain, fog or darkness.",
  ],
  [
    DRIVE,
    "Load security is the responsibility of:",
    [
      "The driver only",
      "The driver, who must check it before every journey",
      "The loading team only",
      "The fleet manager",
    ],
    1,
    1,
    "The driver is legally accountable for the load being secure and correctly distributed, and must re-check after any stop.",
  ],
  [
    DRIVE,
    "Signs of fatigue before driving include:",
    [
      "Yawning, heavy blinking and lane drift",
      "Improved reaction time",
      "Increased alertness",
      "Reduced fuel use",
    ],
    0,
    1,
    "Take a 20-minute break every 4 hours or 2 hours of night driving. Coffee alone is not a substitute for rest.",
  ],
  [
    DRIVE,
    "After a minor collision you should:",
    [
      "Drive on to the next town and report it tomorrow",
      "Stop safely, make the scene safe, exchange details, photograph and report",
      "Move the other vehicle out of the way and leave",
      "Only report if someone is injured",
    ],
    1,
    2,
    "Photographs and exchanged details before moving vehicles are the evidence you will need. Report within 24 hours in any case.",
  ],
  [
    DRIVE,
    "Anti-lock braking systems work best when you:",
    [
      "Stand on the pedal without braking",
      "Brake firmly and hold pressure — the system modulates for you",
      "Alternate pedal and accelerator",
      "Use only the handbrake",
    ],
    1,
    2,
    "ABS prevents wheel lock-up under braking; stamping the brake defeats the function and lengthens the stopping distance.",
  ],
  [
    DRIVE,
    "Driving through floodwater is acceptable when the water is:",
    [
      "Any depth if the vehicle is 4x4",
      "Never — unknown depth can hide washouts and currents that sweep a vehicle away",
      "Under 200 mm",
      "On an unclassified road",
    ],
    1,
    1,
    "Most of the danger is concealed — submerged edges, potholes and fast current. Turn around and report the hazard.",
  ],
];

/* ── Materialise into full Question objects ───────────────────── */

function slugify(text: string, index: number): string {
  const base = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `qst_${base}-${index}`;
}

const perCoursePosition = new Map<string, number>();

export const questions: Question[] = seeds.map((seed, i) => {
  const [courseId, text, options, correct, difficulty, explanation] = seed;
  const position = (perCoursePosition.get(courseId) ?? 0) + 1;
  perCoursePosition.set(courseId, position);

  const id = slugify(text, i + 1);
  const timesServed = 40 + ((i * 37) % 180);
  const successRate = 0.42 + ((i * 17) % 55) / 100;
  const timesCorrect = Math.round(timesServed * successRate);

  return {
    id,
    courseId,
    text,
    options: options.map((opt, oi) => ({
      id: `${id}_o${oi + 1}`,
      text: opt,
      isCorrect: oi === correct,
    })),
    difficulty,
    explanation,
    position,
    timesServed,
    timesCorrect,
  };
});

export const questionsByCourse = new Map<string, Question[]>();
for (const q of questions) {
  const list = questionsByCourse.get(q.courseId) ?? [];
  list.push(q);
  questionsByCourse.set(q.courseId, list);
}

export const questionById = new Map(questions.map((q) => [q.id, q]));
