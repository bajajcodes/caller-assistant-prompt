import { ActiveCallConfig } from "service/activecall-service";

export function deleteActiveCall() {
  ActiveCallConfig.getInstance().deleteCallConfig();
}
