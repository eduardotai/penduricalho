import type { ManeuverDef } from "../types";

export const MANEUVERS: Record<string, ManeuverDef> = {
  fullRotation: {
    id: "fullRotation",
    name: "Full Rotation",
    bonus: 25,
    description: "Complete a full 360 around the pivot.",
  },
  highArc: {
    id: "highArc",
    name: "High Arc",
    bonus: 10,
    description: "Swing the bob above the pivot.",
  },
  doubleSwing: {
    id: "doubleSwing",
    name: "Double Swing",
    bonus: 15,
    description: "Two direction changes within 600ms.",
  },
  comboHit: {
    id: "comboHit",
    name: "Combo Hit",
    bonus: 5,
    description: "+5 per combo stack.",
  },
  perfectTwist: {
    id: "perfectTwist",
    name: "Perfect Twist",
    bonus: 8,
    description: "Twist aligned with motion tangent.",
  },
};
