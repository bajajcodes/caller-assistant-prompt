import "./App.css";

function App() {
  return (
    <>
      <form className="form">
        <label>
          <p>Call To Number:</p>
          <input name="number" required />
        </label>
        <label>
          <p>Data or Data Presentation:</p>
          <textarea name="data" required />
        </label>
        <button type="submit">Make Call</button>
      </form>
      <section>Once You Make Call, call-status will be updated here.</section>
      <section>
        Once You Make Call, call-transcription will be updated here.
      </section>
      <section>After call, application status will be visible here.</section>
    </>
  );
}

export default App;
