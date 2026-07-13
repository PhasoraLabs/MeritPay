# MeritPay MVP Build Prompt for Claude

You are an expert full-stack blockchain developer specializing in Stellar Soroban and zero-knowledge proofs. Build a complete, production-ready MVP for **MeritPay: ZK Performance-Linked Confidential Payroll on Stellar** for the Stellar Hacks: Real-World ZK hackathon.

### Project Overview & Goals
- **Name**: MeritPay
- **Tagline**: Privacy-preserving, merit-based payroll with private KPI proofs and selective auditor disclosure on Stellar.
- **Core Innovation** (what makes it stand out): Employees generate private ZK proofs of their KPIs (e.g., hours worked, targets met). The system aggregates base salaries + performance bonuses privately and proves the entire payroll batch is correct on-chain. Includes selective disclosure proofs for auditors (e.g., total bonuses within budget). This goes far beyond basic sum-hiding payroll projects.
- **Judging Alignment**:
  1. Real-world problem: Privacy + fairness in performance pay for DAOs, remote teams, and Stellar-based businesses using stablecoins.
  2. ZK value: Private KPI proofs + bonus logic + aggregate verification + selective disclosure.
  3. Stellar integration: Off-chain proof generation → on-chain Groth16 verification in Soroban contract + fund release.

Target: Polished MVP that can win top 3 — clean code, excellent README, working testnet demo flow, and a compelling differentiator.

### Required Deliverables
Generate the full project structure with all files and code. Include:
- Complete `README.md` (use the detailed structure from our conversation: Problem, Solution, ZK Value, Stellar Integration, Architecture (with Mermaid), Features, Tech Stack, Build Guide from Scratch, How to Run, Project Structure, Future Roadmap, etc.)
- All source code for circuits, contracts, frontend, and scripts.
- Clear instructions for deployment and demo.

### Tech Stack (Strict)
- **ZK**: Circom 2.0 + snarkjs (Groth16) for KPI + payroll circuits (primary). Include comments on how to extend with RISC Zero for more complex logic.
- **Blockchain**: Stellar Soroban (Rust contracts) — use official Groth16 verifier example as base.
- **Frontend**: NextJs + @stellar/freighter-api + stellar-sdk.
- **Other**: Node.js, Rust (soroban-cli), Mermaid for diagrams.

### Core Features (MVP Scope)
1. Employer dashboard: Input base salaries + performance rules (mock data for 3-5 employees).
2. Employee side: Private KPI input → generate ZK proof (hours ≥ threshold, sales target, etc.).
3. Payroll aggregator circuit: Proves sum of (base + performance bonus) is correct, ranges valid, and no double-claiming.
4. Soroban verifier + payroll contract: Verify proof on-chain → release funds from a pool to private claims (using nullifiers or simple shielded logic).
5. Auditor mode: Generate a lightweight selective disclosure proof (e.g., "total payroll ≤ budget").
6. Responsive React dApp with Freighter wallet connection (Stellar Testnet).
7. Mock USDC/XLM asset usage.

### Detailed Architecture
- Off-chain: Circom circuits for KPI proof + main payroll proof.
- On-chain: Groth16 verifier contract + payroll management contract.
- Frontend orchestrates proof generation and contract calls.

### Step-by-Step Requirements for You (Claude)
1. **First**, output the complete project folder structure.
2. **Then**, generate the full `README.md` with all sections filled professionally.
3. **ZK Circuits**:
   - Create `circuits/kpi.circom` (private KPI range/target proof).
   - Create `circuits/payroll_aggregator.circom` (combines salaries + bonuses + total proof).
   - Provide exact commands for compilation, trusted setup (hackathon-friendly Phase 1), witness generation, and proof creation in JavaScript.
4. **Smart Contracts**:
   - Adapt the official Groth16 verifier.
   - Create a `payroll` contract in Rust that verifies the proof and manages a simple pool + claims.
5. **Frontend**:
   - Full React app with pages: Employer Prepare, Employee Submit KPI, Verify & Release, Auditor View.
   - Integrate proof generation and Soroban calls.
6. **Scripts**: Deployment scripts, proof generation helpers.
7. **Demo Flow**: Provide a clear user journey for the 2-3 minute video.
8. **Testnet Instructions**: Everything must work on Stellar Testnet.

### Build from Scratch Instructions
- Include all prerequisite installation commands.
- Detailed step-by-step build guide in README.
- Use mock data where needed but note it clearly.
- Make code clean, well-commented, and hackathon-judge friendly.
- Include limitations section (MVP scope, mock data, etc.).

### Polish Requirements
- Professional README with badges, Mermaid diagram, testnet tx placeholders.
- Error handling and clear console logs.
- Responsive UI.
- Make it easy to run locally and deploy.

Generate the entire project now. Start with the folder structure and README, then proceed file by file. After each major section, ask if I want adjustments before continuing. Ensure the project is cohesive and highlights the performance-linked private KPI feature as the unique differentiator.

Begin building MeritPay MVP now!