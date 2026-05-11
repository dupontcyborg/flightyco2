export {
  type AircraftLookup,
  aircraftMappingLoaded,
  aircraftToIcao,
  type MappingFile,
  type SupportLevel,
  setAircraftMapping,
} from "./data.ts";
export {
  type AircraftFuelBurn,
  type FuelBurnFile,
  fuelBurnLoaded,
  fuelBurnVersion,
  getFuelBurnEntry,
  interpolateCcdFuel,
  setFuelBurn,
} from "./fuel-burn.ts";
export {
  loadAircraftData,
  loadAircraftMapping,
  loadFuelBurn,
  loadSeatConfigs,
} from "./load.ts";
export {
  type AircraftBody,
  getSeatConfig,
  type SeatConfig,
  type SeatConfigFile,
  type SeatConfigLookup,
  seatConfigsLoaded,
  setSeatConfigs,
} from "./seat-config.ts";
