/**
 * The app entry (`package.json` "main"). Crash reporting starts first so an error while the router
 * and the root layout load is still caught; then Expo Router takes over exactly as
 * `expo-router/entry` would on its own. Import order is the execution order here.
 */
import './init';
import 'expo-router/entry';
