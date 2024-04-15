import { useContext, useState } from "react";
import useSWRMutation from "swr/mutation";
import { CallContext } from "./call-context";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";

const API_BASE_URL = "";

const makeACallFetcher = async (
  _endpoint: string,
  { arg }: { arg: { providerData: string } }
) => {
  if (!arg.providerData) {
    throw Error("Provider Data is missing");
  }

  const response = await fetch(`${API_BASE_URL}/makeoutboundcall`, {
    method: "POST",
    body: arg.providerData,
    headers: {
      "Content-Type": "application/json",
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Error!: ${data?.message}`);
  }

  return data;
};

export const MakeCallForm = () => {
  const { updateCallSid } = useContext(CallContext);
  const [providerData, setProviderData] = useState("");
  const { data, error, isMutating, trigger } = useSWRMutation(
    providerData ? "/makeoutboundcall" : null,
    makeACallFetcher
  );

  const handleMakeCall = () => {
    trigger({ providerData }).then((data) => {
      if (data && data.callSid) {
        updateCallSid(data.callSid);
      }
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="space-y-2 text-center">
        <Label className="text-lg" htmlFor="provider-data">
          Make Call Form
        </Label>
        <Textarea
          className="min-h-[220px] md:min-h-[420px] w-full resize-none"
          id="provider-data"
          placeholder="Enter provider data"
          value={providerData}
          onChange={(e) => setProviderData(e.target.value)}
        />
        <p className="text-xs text-gray-500">
          Ensure that the <strong>call_to</strong> number is added to the{" "}
          <strong>phoneNumber</strong> key.
        </p>
      </div>
      <Button
        className="self-start w-full"
        onClick={handleMakeCall}
        disabled={isMutating || !providerData}
      >
        {isMutating ? "Making Call..." : "Make Call"}
      </Button>
      {isMutating && <div className="text-blue-500">Loading...</div>}
      {!isMutating && data && (
        <div className="text-green-500">
          {data.message}
          <br />
          Call SID: {data.callSid}
        </div>
      )}
      {!isMutating && error && (
        <div className="text-red-500">{error.message}</div>
      )}
    </div>
  );
};
