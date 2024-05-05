import { IVRMenu } from "service/ivr-service";

interface ProviderData extends Record<string, string> {
  phoneNumber: string;
}

export interface CallData {
  ivrMenu: Array<IVRMenu>;
  providerData: ProviderData;
}

function isValidCallData(data: Partial<CallData>): {
  isValid: boolean;
  message: string;
} {
  if (!data.ivrMenu) {
    return {
      isValid: false,
      message: "IVR Menu is missing.",
    };
  }
  if (!data.ivrMenu.length) {
    return {
      isValid: false,
      message: "Invalid IVR Menu, cannot be empty.",
    };
  }
  if (!data?.providerData)
    return {
      isValid: false,
      message: "Provider Data is missing.",
    };
  if (!data?.providerData?.phoneNumber)
    return {
      isValid: false,
      message: "Invalid Provider Data, PhoneNumber is Missing.",
    };
  return { isValid: true, message: "" };
}

function updateIVRMenus(data: CallData): Array<IVRMenu> {
  return data.ivrMenu.map((ivrMenu) => {
    const updatedResponse = ivrMenu.response.replace(
      /\{(.*?)\}/g,
      (match, key) => {
        return data.providerData[key] || match;
      }
    );
    const updateTriggers = ivrMenu.triggers.map((trigger) => {
      return trigger.replace(/\{(.*?)\}/g, (match, key) => {
        return data.providerData[key] || match;
      });
    });
    return {
      ...ivrMenu,
      response: updatedResponse,
      triggers: updateTriggers,
    };
  });
}

export { isValidCallData, updateIVRMenus };
