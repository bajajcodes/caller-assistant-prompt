import { IVRMenu } from "service/ivr-service";

interface ProviderData extends Record<string, string> {
  phoneNumber: string;
}

export interface CallData {
  ivrMenu: Array<IVRMenu>;
  providerData: ProviderData;
}

export const PROVIDER_DATA_KEY_REGEX = /\{(.*?)\}/g;

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

function updateIVRMenus(data: CallData) {
  const transformedIvrMenu = data.ivrMenu.map((ivrMenu) => {
    const outputResponse = ivrMenu.response
      .replace(PROVIDER_DATA_KEY_REGEX, (match, key) => {
        return data.providerData[key] || match;
      })
      .toLowerCase()
      .replaceAll(/[^a-zA-Z0-9\s]/g, "");
    const outputTriggers = ivrMenu.triggers.map((trigger) => {
      return trigger
        .replace(PROVIDER_DATA_KEY_REGEX, (match, key) => {
          return data.providerData[key] || match;
        })
        .toLowerCase()
        .replaceAll(/[^a-zA-Z0-9\s]/g, "");
    });
    return {
      ...ivrMenu,
      response: outputResponse,
      triggers: outputTriggers,
    };
  });
  const updatedIvrMenu = transformedIvrMenu.map((ivrMenu) => {
    const updatedResponse = ivrMenu.response.replaceAll(/\s/g, "");
    const updatedTriggers = ivrMenu.triggers.map((trigger) => {
      return trigger.replaceAll(/\s/g, "");
    });
    return {
      ...ivrMenu,
      response: updatedResponse,
      triggers: updatedTriggers,
    };
  });
  return {
    updatedIvrMenu,
    transformedIvrMenu,
  };
}

export { isValidCallData, updateIVRMenus };
