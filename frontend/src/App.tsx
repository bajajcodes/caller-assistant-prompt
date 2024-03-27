import "./App.css";
import {
  FetchAndRenderCallStatus,
  FetchAndRenderTranscription,
  HangupAndRestCall,
  MakeCall,
} from "./components";

function App() {
  return (
    <main className="container mx-auto p-4 text-center grid lg:grid-cols-[1fr_2fr_2fr] gap-4">
      <HangupAndRestCall />
      <div>
        <MakeCall />
        <FetchAndRenderCallStatus />
      </div>
      <div>
        {/* <FetchAndRenderApplicationStatus /> */}
        <FetchAndRenderTranscription />
      </div>
    </main>
  );
}

export default App;
