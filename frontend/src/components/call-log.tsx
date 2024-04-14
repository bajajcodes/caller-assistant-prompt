import { useContext } from "react";
import useSWR from "swr";
import { CallContext } from "./call-context";
import { Button } from "./ui/button";

const API_BASE_URL = "http://localhost:3000";

const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to fetch call details");
  }
  return response.json();
};

export const CallLog = () => {
  const { getCallSid, hangupCall } = useContext(CallContext);
  const callSid = getCallSid();

  const { data, error } = useSWR(
    callSid ? `${API_BASE_URL}/calllog/${callSid}` : null,
    fetcher,
    {
      refreshInterval: 5000, // Poll every 5 seconds
    }
  );

  const handleHangupCall = () => {
    try {
      if (!callSid) return;
      hangupCall({ callSid });
    } catch (error) {
      console.error("Error while hanging up the call:", error);
    }
  };

  return (
    <div className="flex flex-col gap-4 md:gap-2">
      <div className="flex gap-2">
        <div className="grid gap-1">
          <h3 className="text-lg font-medium">Call Status</h3>
          {!callSid || callSid === "NA" ? (
            <p className="text-sm text-gray-500">Waiting for call SID...</p>
          ) : error ? (
            <p className="text-sm text-red-500">Failed to load call status.</p>
          ) : !data ? (
            <p className="text-sm text-gray-500">Loading call status...</p>
          ) : (
            <p className="text-sm text-gray-500 leading-none">
              The call is <strong>{data.status}</strong>.
            </p>
          )}
        </div>
        <Button
          className="self-start w-[140px]"
          variant="destructive"
          onClick={handleHangupCall}
          disabled={!callSid}
        >
          Hangup Call
        </Button>
      </div>
      <div className="flex flex-col gap-2">
        <div className="grid gap-1">
          <h3 className="text-lg font-medium">Call Transcription</h3>
          {!callSid || callSid === "NA" ? (
            <p className="text-sm text-gray-500">Waiting for call SID...</p>
          ) : error ? (
            <p className="text-sm text-red-500">
              Failed to load call transcription.
            </p>
          ) : !data ? (
            <p className="text-sm text-gray-500">
              Loading call transcription...
            </p>
          ) : (
            data.transcription.map(
              (message: { role: string; content: string }, index: number) => (
                <p key={index} className="text-sm">
                  <span className="font-medium">{message.role}: </span>
                  {message.content}
                </p>
              )
            )
          )}
        </div>
      </div>
    </div>
  );
};
