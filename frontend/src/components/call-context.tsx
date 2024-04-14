import React, { createContext, useState } from "react";
import useSWRMutation from "swr/mutation";

const API_BASE_URL = "";
export const CallContext = createContext({
  getCallSid: (): string | null => null,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  updateCallSid: (_?: string) => {},
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  hangupCall: (_: { callSid: string }) => {},
});

const hangupCallFetcher = async (
  url: string,
  { arg }: { arg: { callSid: string } }
) => {
  const payload = {
    callSid: arg.callSid,
    callEndedBy: "SELF",
    callEndReason: "NA",
  };
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  return await response.json();
};

export const CallProvider = ({
  children,
}: {
  children: React.ReactNode | Array<React.ReactNode>;
}) => {
  const [callSid, setCallSid] = useState<string | null>("");
  const { trigger: hangupCall } = useSWRMutation(
    `${API_BASE_URL}/hangupcall`,
    hangupCallFetcher,
    {
      onSuccess: (data) => {
        if (data.success) {
          setCallSid(null);
        } else {
          console.error("Error while hanging up the call");
          alert("Failed to hang up the call. Please try again.");
        }
      },
      onError: () => {
        console.error("Error while hanging up the call");
        alert("An error occurred while hanging up the call. Please try again.");
      },
    }
  );

  const getCallSid = () => {
    return callSid;
  };

  const updateCallSid = (sid?: string) => {
    if (!sid) return;
    setCallSid(sid);
  };

  return (
    <CallContext.Provider value={{ getCallSid, updateCallSid, hangupCall }}>
      {children}
    </CallContext.Provider>
  );
};
