/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import useSWR from "swr";
import useSWRMutation from "swr/mutation";
import "./App.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const makeACallFetcher = async (
  endpoint: string,
  { arg }: { arg: { twilioCallToNumber: string; providerData: string } }
) => {
  if (!arg.twilioCallToNumber || !arg.providerData) {
    throw Error("Input's are missing");
  }
  console.log({ endpoint, arg });
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
  console.info({ data });
  return data.transcription;
};

function App() {
  const { trigger, data, isMutating } = useSWRMutation(
    "/makeacall",
    makeACallFetcher
  );

  const onSubmit = (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const formData = new FormData(ev.currentTarget);
    const twilioCallToNumber = formData.get("twilioCallToNumber") as string;
    const providerData = formData.get("providerData") as string;
    const filteredProvidedData = providerData
      .split(" ")
      .filter(Boolean)
      .join(" ");
    console.log({ providerData, filteredProvidedData });
    trigger({ twilioCallToNumber, providerData });
  };

  return (
    <main className="w-full container grid grid-cols-2">
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
        {data && !isMutating && (
          <FetchAndRender isLoading={isMutating} data={data} />
        )}
      </form>
      <FetchAndRenderTranscription />
    </main>
  );
}

const FetchAndRender = ({
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

const FetchAndRenderTranscription = () => {
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

export default App;
