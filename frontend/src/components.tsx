/* eslint-disable @typescript-eslint/no-explicit-any */
import useSWR from "swr";
import useSWRMutation from "swr/mutation";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const makeACallFetcher = async (
  _endpoint: string,
  { arg }: { arg: { twilioCallToNumber: string; providerData: string } }
) => {
  if (!arg.twilioCallToNumber || !arg.providerData) {
    throw Error("Input's are missing");
  }
  const response = await fetch(`${API_BASE_URL}/makeacall`, {
    method: "POST",
    body: JSON.stringify(arg),
    headers: {
      "Content-Type": "application/json",
    },
  });
  return await response.json();
};

const transcriptionFetcher = async () => {
  const response = await fetch(`${API_BASE_URL}/transcription`);
  const data = await response.json();
  return data.transcription;
};

const getCallStatus = async () => {
  const response = await fetch(`${API_BASE_URL}/callstatus`);
  return await response.json();
};

function MakeACallForm({
  onFormDataSubmit,
  isMutating,
}: {
  onFormDataSubmit: ({
    twilioCallToNumber,
    providerData,
  }: {
    twilioCallToNumber: string;
    providerData: string;
  }) => void;
  isMutating: boolean;
}) {
  const onSubmit = (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const formData = new FormData(ev.currentTarget);
    const twilioCallToNumber = formData.get("twilioCallToNumber") as string;
    const providerData = formData.get("providerData") as string;
    onFormDataSubmit({ twilioCallToNumber, providerData });
  };
  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit}>
      <h1 className="text-4xl font-bold">Make Call Form</h1>
      <label>
        <p>Call To Number:</p>
        <input
          name="twilioCallToNumber"
          className="focus:text-white"
          required
        />
      </label>
      <label>
        <p>Data or Data Presentation:</p>
        <textarea
          className="h-16 w-full focus:text-white"
          name="providerData"
          required
        />
      </label>
      <button
        type="submit"
        className="bg-blue-500 hover:bg-blue-500/90 text-white"
        disabled={isMutating}
      >
        Make Call
      </button>
    </form>
  );
}

const FetchAndRenderCallInfo = ({
  data,
  isLoading,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>;
  isLoading: boolean;
}) => {
  return (
    <div>
      {!data?.callInitiated && data?.message && (
        <p className="text-red-500 font-semibold">{data.message}</p>
      )}
      {data?.callInitiated && data?.message && (
        <p className="text-green-500 font-semibold">{data.message}</p>
      )}
      {isLoading && <p className="text-yellow-500 font-semibold">Loading...</p>}
    </div>
  );
};

export const MakeCall = () => {
  const { trigger, data, isMutating } = useSWRMutation(
    "/makeacall",
    makeACallFetcher
  );
  return (
    <div>
      <MakeACallForm onFormDataSubmit={trigger} isMutating={isMutating} />
      <FetchAndRenderCallInfo data={data} isLoading={isMutating} />
    </div>
  );
};

export const FetchAndRenderTranscription = () => {
  const { data } = useSWR("/transcription", transcriptionFetcher, {
    refreshInterval: 1000,
    revalidateIfStale: true,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
  });
  const filteredData = data?.slice?.(1) || ([] as Array<unknown>);
  return (
    <section>
      <h2 className="text-4xl font-bold">Transcription</h2>
      <ul className="flex flex-col gap-4 max-h-[480px] overflow-y-scroll scroll-smooth border-2 p-4">
        {filteredData.map((item: Record<string, any>) => {
          console.info({ item });
          return (
            <li>
              <span className="font-semibold text-orange-500">{item.role}</span>
              :&nbsp;
              <span className="leading-8">
                {item.content.content || item.content}
              </span>
            </li>
          );
        })}
        {filteredData.length < 1 && (
          <p className="text-base leading-8 text-gray-500">
            Will be available in a moment.
          </p>
        )}
      </ul>
    </section>
  );
};

export const FetchAndRenderCallStatus = () => {
  const { data, isLoading } = useSWR("/callstatus", getCallStatus, {
    refreshInterval: 1000,
    revalidateIfStale: true,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
  });
  console.log({ isLoading, data });
  return (
    <div>
      <h2 className="text-4xl font-bold">Application Status</h2>
      <p className="text-cyan-500 font-bold">{JSON.stringify(data)}</p>
    </div>
  );
};
