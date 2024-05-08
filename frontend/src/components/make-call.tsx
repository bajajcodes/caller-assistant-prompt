import useSWRMutation from "swr/mutation";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Skeleton } from "./ui/skeleton";
import { Textarea } from "./ui/textarea";

const makeACallFetcher = async (
  _endpoint: string,
  {
    arg,
  }: {
    arg: {
      providerData: Record<string, string>;
      ivrMenu: Record<string, string>;
    };
  }
) => {
  if (!arg.providerData) {
    throw Error("Provider Data is missing");
  }
  if (!arg.ivrMenu) {
    throw Error("IVR Menu is missing");
  }
  const payloadJsonString = JSON.stringify(arg);

  const response = await fetch(`/makeoutboundcall`, {
    method: "POST",
    body: payloadJsonString,
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
  const { data, error, isMutating, trigger } = useSWRMutation(
    "/makeoutboundcall",
    makeACallFetcher
  );

  return (
    <div>
      <form
        className="flex flex-col gap-2"
        onSubmit={(ev) => {
          ev.preventDefault();
          const formData = new FormData(ev.currentTarget);
          const plainFormData = Object.fromEntries(formData.entries());
          if (!plainFormData?.providerData) {
            throw Error("Provider Data is missing");
          }
          if (!plainFormData?.ivrMenu) {
            throw Error("IVR Menu is missing");
          }
          trigger({
            ivrMenu: plainFormData.ivrMenu as unknown as Record<string, string>,
            providerData: plainFormData.providerData as unknown as Record<
              string,
              string
            >,
          });
        }}
      >
        <h2 className="text-lg">Make Call Form</h2>
        <div className="grid grid-cols-[1.5fr_1fr] grid-flow-row gap-4 text-center">
          <Label>
            <Textarea
              className="min-h-[220px] md:min-h-[420px] w-full resize-none"
              name="providerData"
              placeholder="Enter provider data"
              required
              aria-required
            />
            <p className="text-xs text-gray-500 mt-2">
              Ensure that the <strong>call_to</strong> number is added to the{" "}
              <strong>phoneNumber</strong> key.
            </p>
          </Label>
          <Label>
            <Textarea
              className="min-h-[220px] md:min-h-[420px] w-full resize-none"
              name="ivrMenu"
              placeholder="Enter IVR menu"
              required
              aria-required
            />
          </Label>
        </div>
        <Button className="self-start w-full" disabled={isMutating}>
          {isMutating ? "Making Call..." : "Make Call"}
        </Button>
      </form>
      {isMutating && (
        <Card className="mt-4">
          <CardContent className="pt-6 grid gap-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-28 w-full" />
          </CardContent>
        </Card>
      )}
      {!isMutating && data && (
        <Card className="mt-4">
          <CardContent className="pt-6 grid gap-4">
            <Label>
              Call Message:
              <Input readOnly value={data.message} />
            </Label>
            <Label>
              Call Sid:
              <Input value={data.callSid} readOnly />
            </Label>
            <Label>
              Updated Ivr Menu:
              <Textarea
                readOnly
                value={JSON.stringify(data.updatedIvrMenu, null, 2)}
              />
            </Label>
          </CardContent>
        </Card>
      )}
      {!isMutating && error && (
        <Card className="mt-4">
          <CardContent className="text-red-500 pt-6">
            Error: {error.message}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
