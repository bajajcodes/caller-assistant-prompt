/* eslint-disable @typescript-eslint/no-explicit-any */
import useSWR from "swr";
import useSWRMutation from "swr/mutation";

const API_BASE_URL = "";

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
  const data = await response.json();
  return data.callStatus;
};

const getApplicationStatus = async () => {
  const response = await fetch(`${API_BASE_URL}/applicationstatus`);
  const data = await response.json();
  return data.applicationStatus;
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
        <p>Call To Number</p>
        <input
          name="twilioCallToNumber"
          className="focus:text-white"
          required
        />
      </label>
      <label>
        <p>Data or Data Presentation</p>
        <textarea
          className="h-96 max-h-96 w-full resize-y focus:text-white"
          name="providerData"
          required
        />
      </label>
      <button
        type="submit"
        className="bg-blue-500 hover:bg-blue-500/90 text-white py-2 px-4 max-w-64 mx-auto w-full"
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
  const { data, isLoading } = useSWR("/transcription", transcriptionFetcher, {
    refreshInterval: 5000,
    revalidateIfStale: true,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
  });
  const transcription = data || [];
  return (
    <section>
      <h2 className="text-4xl font-bold">Transcription</h2>
      {transcription?.length < 1 ? (
        <p className="text-base leading-8 text-gray-500">
          {isLoading
            ? "Fetching Transcription."
            : "Will be available in a moment."}
        </p>
      ) : (
        <ul className="flex flex-col gap-4 max-h-[480px] overflow-y-scroll scroll-smooth border-2 p-4 leading-8 mt-4 ">
          {transcription.map((item: Record<string, any>) => (
            <li>
              <span className="font-semibold text-orange-500">{item.role}</span>
              :&nbsp;
              <span className="leading-8">{item.content}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export const FetchAndRenderApplicationStatus = () => {
  const { data, isLoading } = useSWR(
    "/applicationstatus",
    getApplicationStatus,
    {
      refreshInterval: 10000,
      revalidateIfStale: true,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    }
  );
  const {
    data: mutationData,
    trigger,
    isMutating,
  } = useSWRMutation("/applicationstatus", getApplicationStatus);
  const applicationStatus = data || mutationData || "--";
  const isDataAvailable = Boolean(data || mutationData);
  return (
    <div className="">
      <div className="flex gap-4 items-center justify-center">
        <h2 className="text-4xl font-bold text-white">Application Status</h2>
        <button
          type="button"
          onClick={() => trigger()}
          className="hover:ring-0 focus:ring-0 hover:border-none focus:border-none focus-within:ring-0"
        >
          🔃
        </button>
      </div>
      {!isDataAvailable ? (
        <>
          <div className="text-base leading-8 text-gray-500">
            {isLoading || isMutating
              ? "Fetching Application Status"
              : " Will be available in a moment."}
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-4">
            <p>
              <span className="font-semibold text-orange-500">
                status:&nbsp;
              </span>
              <span className="leading-8">{applicationStatus}</span>
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export const FetchAndRenderCallStatus = () => {
  const { data, isLoading } = useSWR("/callstatus", getCallStatus, {
    refreshInterval: 5000,
    revalidateIfStale: true,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
  });
  const callStatus = data || "--";
  return (
    <div className="mt-4">
      <h2 className="text-4xl font-bold text-white">Call Status</h2>
      {!data ? (
        <>
          <div className="text-base leading-8 text-gray-500">
            {isLoading
              ? "Fetching Call Status"
              : " Will be available in a moment."}
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-4">
            <p>
              <span className="font-semibold text-orange-500">
                status:&nbsp;
              </span>
              <span className="leading-8">{callStatus}</span>
            </p>
          </div>
        </>
      )}
    </div>
  );
};
