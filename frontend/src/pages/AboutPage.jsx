export default function AboutPage() {
  return (
    <div className="page-grid">
      <section className="section-header">
        <div>
          <p className="eyebrow">Legal disclaimer</p>
          <h1>Important Safety Notice</h1>
        </div>
      </section>

      <section className="info-panel">
        <h2>Not an emergency service</h2>
        <p>
          RescueMe is a communication and situational awareness tool. It is not a 911 service, dispatch center, public safety agency, medical provider, or guaranteed
          emergency alert system. If someone may be in immediate danger, call 911 or your local emergency number as soon as it is safe and possible.
        </p>
      </section>

      <section className="info-panel">
        <h2>User reports are not verified facts</h2>
        <p>
          Reports may be incomplete, inaccurate, outdated, duplicated, submitted by mistake, or intentionally false. Confidence scores, confirmations, comments,
          responder notes, live incident feeds, map markers, and AI guidance are decision-support signals only. Always use your own judgment and follow official responder
          instructions when they are available.
        </p>
      </section>

      <section className="info-panel">
        <h2>Maps, locations, and live feeds can be wrong</h2>
        <p>
          Map tiles, device location, typed addresses, geocoding results, National Weather Service alerts, and user-submitted coordinates can contain errors or delays.
          Do not enter unsafe areas, cross barriers, drive through floodwater, or rely on a marker as proof that a route, supply point, shelter, or hazard is safe.
        </p>
      </section>

      <section className="info-panel">
        <h2>No medical, legal, or professional advice</h2>
        <p>
          RescueMe may show safety guidance for incidents, including AI-generated guidance. That guidance is general information only and is not medical, legal,
          engineering, security, transportation, or professional emergency-response advice. For medical emergencies, contact emergency services or qualified medical
          professionals.
        </p>
      </section>

      <section className="info-panel">
        <h2>Privacy and sensitive information</h2>
        <ul className="plain-list">
          <li>Do not post real names, phone numbers, addresses, medical details, photos of private people, or other sensitive personal information unless it is necessary for safety.</li>
          <li>Reports and comments may be visible to other users connected to the same deployment or node.</li>
          <li>Location is attached to reports and comments only when submitted; the app is not intended to continuously track users.</li>
          <li>Exports can contain report text, coordinates, timestamps, comments, confirmation data, and attached images.</li>
          <li>Public deployments should use strong admin and responder tokens, HTTPS, restricted database access, and careful moderation.</li>
        </ul>
      </section>

      <section className="info-panel">
        <h2>Availability and data loss</h2>
        <p>
          RescueMe may be unavailable, delayed, or inconsistent because of network loss, browser storage limits, server restarts, database issues, deployment limits,
          or device battery problems. Local and synced data may be lost if a browser clears storage, a server database is reset, or a hosting provider uses temporary storage.
        </p>
      </section>

      <section className="info-panel">
        <h2>Use at your own risk</h2>
        <p>
          This project is provided as an MVP, demo, and educational prototype. It is provided without warranties of accuracy, availability, fitness for a particular purpose,
          or suitability for life-safety operations. Users and operators are responsible for deciding how, whether, and where to use it.
        </p>
      </section>
    </div>
  );
}
