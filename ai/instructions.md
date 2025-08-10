# GEPA: Functionalities in a precise mathematical form (concise)

## 1) Problem, system, and budget

Let a **compound AI system** be
$\Phi=(M,C,X,Y),\quad M=\langle M_1,\dots,M_{|M|}\rangle,\; M_i=(\pi_i,\theta_i,X_i,Y_i),$
where $\pi_i$ is the (system) prompt for module $i$, $\theta_i$ the LLM weights (fixed), and $C$ the control flow. For a task instance $(x,m)$ the system outputs
$y=\Phi(x;\langle\Pi,\Theta\rangle_\Phi),\quad \Pi=\langle\pi_1,\dots,\pi_{|M|}\rangle,\;\Theta=\langle\theta_1,\dots,\theta_{|M|}\rangle.$
A metric $\mu:Y\times M\to[0,1]$ measures quality. With rollout budget $B$ and training set $D_{\text{train}}=\{(x_i,m_i)\}_{i=1}^N$, define
$\langle\Pi^*,\Theta^*\rangle_\Phi=\arg\max_{\langle\Pi,\Theta\rangle_\Phi}\; \mathbb E_{(x,m)\sim\mathcal T}\big[\mu(\Phi(x;\langle\Pi,\Theta\rangle_\Phi),m)\big]\;\text{s.t.}\;\#\text{rollouts}\le B.$
GEPA fixes $\Theta$ and optimizes $\Pi$ using reflective evolution under budget $B$.

**Data split.** Choose hyperparameters: minibatch size $b$ and Pareto set size $n_{\text{pareto}}$. Split $D_{\text{train}}=D_{\text{feedback}}\cup D_{\text{pareto}}$ with $|D_{\text{pareto}}|=n_{\text{pareto}}$.

**Feedback function.** Define $\mu_f$ that, for a rollout trace $\tau$ on $(x,m)$, returns
$\mu_f(\tau,m)=(s,\;\text{feedback\_text},\;\text{module\_traces}),\quad s=\mu(y,m).$

## 2) Candidate pool and score matrix

A **candidate** is a full system $\Phi^{(k)}$ (i.e., a particular $\Pi$ with fixed $\Theta$). Maintain a pool $\mathcal P=\{\Phi^{(k)}\}_{k=1}^K$ and a score matrix $S\in[0,1]^{K\times n_{\text{pareto}}}$:
$S_{k,j}=\mu\big(\Phi^{(k)}(x_j),m_j\big),\quad (x_j,m_j)\in D_{\text{pareto}}.$
Initialize $\mathcal P\leftarrow\{\Phi\}$ and $S_{1,j}$ by evaluating the base system on $D_{\text{pareto}}$.

## 3) Pareto-based candidate selection (parent sampling)

For each instance $j$, define the instance-best score and winners
$s^*_j=\max_k S_{k,j},\qquad \mathcal P^*_j=\{\Phi^{(k)}:S_{k,j}=s^*_j\}.$
Let **Pareto dominance** on row-vectors $S_{k,:}$ be: $k$ dominates $k'$ if $S_{k,:}\ge S_{k',:}$ elementwise and $S_{k,:}\ne S_{k',:}$. Remove dominated systems from $\bigcup_j \mathcal P^*_j$ to obtain the **non-dominated** set $\widehat{\mathcal C}$. Define frequency
$f(\Phi^{(k)})=\big|\{j:\Phi^{(k)}\in\mathcal P^*_j\}\big|.$
Sample the parent index $k$ from $\widehat{\mathcal C}$ with probability
$\Pr(k)\;\propto\;f(\Phi^{(k)}).$
This preserves diverse, instance-wise winning strategies while filtering dominated ones.

## 4) Reflective prompt mutation (language-native credit assignment)

Select a module $j\in\{1,\dots,|M|\}$ (e.g., round-robin). Draw a minibatch $\mathcal M\subset D_{\text{feedback}}$ with $|\mathcal M|=b$. Run $\Phi^{(k)}$ on $\mathcal M$ to collect traces $\tau$ and $\mu_f$ outputs $\{(s_t,\text{fb}_t,\text{tr}_t)\}_{t\in\mathcal M}$.

Let **prompt update** be an LLM-computed function
$\pi'_j\;=\;\texttt{UPDATEPROMPT}\big(\pi_j;\{(\text{fb}_t,\text{tr}_t)\}_{t\in\mathcal M}\big).$
Form child $\widetilde\Phi$ by replacing $\pi_j\leftarrow\pi'_j$. Compute minibatch means
$\sigma=\tfrac{1}{|\mathcal M|}\!\sum_{t\in\mathcal M}\!\mu\big(\Phi^{(k)}(x_t),m_t\big),\qquad \sigma'=\tfrac{1}{|\mathcal M|}\!\sum_{t\in\mathcal M}\!\mu\big(\widetilde\Phi(x_t),m_t\big).$
**Accept-if-better:** If $\sigma'>\sigma$, add $\widetilde\Phi$ to $\mathcal P$ and evaluate it on all Pareto items to append a new row to $S$.

## 5) System-aware merge (genetic crossover; optional)

Sample two non-ancestral parents \$i\neq j\$ and pick a shared ancestor \$a\$. Define module-level ancestry flags \$E\_k(m)\in{0,1}\$ indicating whether module \$m\$ changed along the path \$a\to k\$. Construct the child \$\Phi^{\text{merge}}\$ module-wise by

$$
\pi_m^{\text{merge}} = \pi_m^{(i)}\;\text{ if } E_i(m)=1 \land E_j(m)=0;\quad
\pi_m^{\text{merge}} = \pi_m^{(j)}\;\text{ if } E_j(m)=1 \land E_i(m)=0;\quad
\pi_m^{\text{merge}} = \pi_m^{(d^*)}\;\text{ if } E_i(m)=E_j(m)=1 \land d^*\in\arg\max_{d\in\{i,j\}} \mathrm{score}(d);\quad
\pi_m^{\text{merge}} = \pi_m^{(i)}\;\text{ otherwise.}
$$

Reject merges that (i) fuse direct ancestors/descendants, (ii) repeat a previously tried triplet \$(i,j,a)\$, (iii) worsen the ancestor’s score, or (iv) introduce no module-level novelty. Evaluate \$\Phi^{\text{merge}}\$ with the accept-if-better gate.

## 6) Overall loop and return

Repeat: **(a)** parent sampling via Pareto (§3), **(b)** propose child via mutation or merge, **(c)** accept-if-better, **(d)** update $S$ on $D_{\text{pareto}}$, until budget $B$ is exhausted. Return the candidate maximizing average performance on $D_{\text{pareto}}$:
$\Phi^*\in\arg\max_{\Phi^{(k)}\in\mathcal P}\; \tfrac{1}{n_{\text{pareto}}}\sum_{j=1}^{n_{\text{pareto}}} S_{k,j}.$

## 7) What is core/unique in GEPA (succinct)

1. **Language-native credit assignment:** prompt edits from textual execution/evaluator traces rather than only scalar rewards.
2. **Instance-wise Pareto parent sampling:** sample from union of per-instance winners, filtered by non-dominance, weighted by frequency.
3. **Greedy accept-if-better gating:** minibatch gate before full validation to conserve rollouts; full matrix update after acceptance.
4. **System-aware crossover:** module-wise recombination guided by ancestry and per-parent scores to merge complementary skills.