import React from 'react';
import { motion } from 'framer-motion';

const STEPS = [
  { n: '01', title: 'Upload OpenAPI',      desc: 'Drop your spec. We parse every endpoint, schema and param.' },
  { n: '02', title: 'Generate & Score',    desc: 'ML models prioritize tests and score endpoint risk.' },
  { n: '03', title: 'Execute Concurrently',desc: 'Run hundreds of validated tests in parallel.' },
  { n: '04', title: 'Get Insights',        desc: 'See anomalies, failures, and trend reports instantly.' },
];

export default function HowItWorks() {
  return (
    <section id="how" className="how">
      <div className="section-header">
        <span className="section-kicker">Workflow</span>
        <h2 className="gradient-text">Four steps. That's it.</h2>
      </div>
      <div className="steps">
        {STEPS.map((s, i) => (
          <motion.div
            key={i}
            className="step glass"
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.12, duration: 0.6 }}
          >
            <div className="step-num">{s.n}</div>
            <h3>{s.title}</h3>
            <p>{s.desc}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
