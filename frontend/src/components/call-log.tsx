import useSWRMutation from "swr/mutation";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Skeleton } from "./ui/skeleton";

const callTranscriptionFetcher = async (
  url: string,
  { arg }: { arg: string }
) => {
  const response = await fetch(`${url}/${arg}`);
  if (!response.ok) {
    throw new Error("Failed to fetch call details");
  }
  return response.json();
};

const hangupCallFetcher = async (url: string, { arg }: { arg: string }) => {
  const payload = {
    callSid: arg,
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
  return response.status === 200;
};

export const CallLog = () => {
  const {
    data,
    error,
    trigger: transcriptionFetcher,
    isMutating,
  } = useSWRMutation("/calllog", callTranscriptionFetcher);

  const { trigger: hangupCall } = useSWRMutation(
    `/hangupcall`,
    hangupCallFetcher,
    {
      onSuccess: (done) => {
        if (!done) {
          console.error("Error while hanging up the call");
          alert("Failed to hang up the call. Please try again.");
        }
        alert("Call Finished");
      },
      onError: () => {
        console.error("Error while hanging up the call");
        alert("An error occurred while hanging up the call. Please try again.");
      },
    }
  );

  const callstatus = data?.callstatus || "NA";
  const ivrTranscription = data?.["ivr--transcription"] || [];
  const transcription = data?.transcription || [];

  return (
    <div className="flex flex-col gap-4 md:gap-2">
      <h2 className="text-lg">Call Log</h2>
      <form
        className="grid grid-cols-[2fr_1fr] gap-4"
        onSubmit={(ev) => {
          ev.preventDefault();
          const plainFormData = new FormData(ev.currentTarget);
          const callSid = plainFormData.get("callsid");
          if (!callSid) return alert("Call Sid is Missing");
          transcriptionFetcher(callSid as string);
        }}
      >
        <Label>
          <Input
            name="callsid"
            placeholder="Enter Call Sid to fetch Transcription"
            required
          />
        </Label>
        <Button>Fetch Transcription</Button>
      </form>
      <form
        className="grid grid-cols-[2fr_1fr] gap-4"
        onSubmit={(ev) => {
          ev.preventDefault();
          const plainFormData = new FormData(ev.currentTarget);
          const callSid = plainFormData.get("callsid");
          if (!callSid) return alert("Call Sid is Missing");
          hangupCall(callSid as string);
        }}
      >
        <Label>
          <Input
            name="callsid"
            placeholder="Enter Call Sid to hangup call"
            required
          />
        </Label>
        <Button variant="destructive">Hangup Call</Button>
      </form>
      {isMutating && (
        <Card className="mt-4">
          <CardContent className="pt-6 grid gap-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>
      )}
      {!isMutating && data && (
        <Card>
          <CardContent className="grid gap-4">
            <div className="flex items-center gap-4">
              <CardDescription>Call Status</CardDescription>
              <p>{callstatus}</p>
            </div>
            <div>
              <CardDescription>
                Customer Rep Interaction Transcription
              </CardDescription>
              <div className="max-h-[50vh] overflow-scroll p-2 border-2">
                {transcription.map(
                  (
                    message: { role: string; content: string },
                    index: number
                  ) => (
                    <p key={index} className="text-sm">
                      <span className="font-medium">{message.role}: </span>
                      {message.content}
                    </p>
                  )
                )}
                {transcription.length < 1 && (
                  <p className="text-sm">
                    {isMutating
                      ? "Fetching Interaction Transcription."
                      : "No Interaction Transcription Available."}
                  </p>
                )}
              </div>
            </div>
            <div>
              <CardDescription>IVR Interaction Transcription</CardDescription>
              <div className="max-h-[50vh] overflow-scroll p-2 border-2">
                {ivrTranscription.map(
                  (
                    message: { role: string; content: string },
                    index: number
                  ) => (
                    <p key={index} className="text-sm">
                      <span className="font-medium">{message.role}: </span>
                      {message.content}
                    </p>
                  )
                )}
                {ivrTranscription.length < 1 && (
                  <p className="text-sm">
                    {isMutating
                      ? "Fetching IVR Interaction Transcription."
                      : "No IVR Interaction Transcription Available."}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      {!isMutating && error && (
        <Card className="mt-4">
          <CardContent className="text-red-500 pt-6">
            Error: {error?.message || "NA"}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
