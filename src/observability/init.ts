/* Side effect only: start crash reporting (if this build has a DSN) before any app code runs. */
import { initObservability } from './sentry';

initObservability();
