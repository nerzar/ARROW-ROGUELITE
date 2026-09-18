// BUILD-035: types for the plain-JS viewer module ./projectile-flight.js (kept as .js so
// the browser visual-proto shell can import it directly; this .d.ts only serves tsc/vitest).
export declare const FLIGHT_MS: number
export declare const STRAIGHT_FRAC: number
export interface FlightPt { x: number; y: number }
export interface FlightSpec { from: FlightPt; dir: FlightPt; target: FlightPt | null; straightLen: number }
export interface FlightPose { x: number; y: number; angle: number }
export declare function straightLen(from: FlightPt, target: FlightPt): number
export declare function flightPoint(t: number, spec: FlightSpec): FlightPose
