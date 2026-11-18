/**
 * The app entry (`package.json` "main"). Crash reporting starts first so an error while the router
 * and the root layout load is still caught; then Expo Router takes over exactly as
 * `expo-router/entry` would on its own; last, the Android home-screen widget's headless task is
 * registered (system.md N29), after crash reporting so a failure in it is reported too. Import
 * order is the execution order here.
 */
import './init';
import 'expo-router/entry';
import '../widget/register';
