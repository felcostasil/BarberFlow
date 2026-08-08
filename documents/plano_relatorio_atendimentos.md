# Plano de Ação: Relatório de Atendimentos por Período

Este documento descreve os passos necessários para implementar a geração de relatórios de clientes atendidos em um período específico, com separação e agrupamento visual por barbeiro.

---

## 1. Alteração no Modelo de Dados (Schema)

Atualmente, os registros da fila possuem apenas `created_at`. Para gerar relatórios precisos por período de finalização, precisamos persistir a data em que o atendimento foi concluído.

### Campos a adicionar no documento do cliente (`queue`):
* `completed_at` (Timestamp/Número em ms): Registrado no momento em que o barbeiro define o status do cliente como concluído (`done`).
* `assigned_barber_id` (String): ID do barbeiro que atendeu o cliente (útil para referências confiáveis mesmo se o barbeiro mudar de nome).
* `assigned_barber_name` (String): Nome do barbeiro que atendeu no momento da finalização (para fins históricos rápidos).

---

## 2. Atualização dos Fluxos de Alteração de Fila

No painel do barbeiro (`AdminQueue.vue`), ao finalizar um atendimento:
* Atualizar o documento no banco de dados definindo:
  * `status = 'done'`
  * `completed_at = Date.now()`
  * `assigned_barber_id = barbeiroLogado.id`
  * `assigned_barber_name = barbeiroLogado.name`

---

## 3. Implementação da Consulta no Serviço

No arquivo `firebase.ts`, adicionar uma função para buscar os atendimentos concluídos no intervalo desejado:

```typescript
export const getCompletedClientsByPeriod = async (startDate: number, endDate: number): Promise<any[]> => {
  // Em produção (Firebase Real)
  if (!isMockMode) {
    const q = query(
      collection(db, 'queue'),
      where('status', '==', 'done'),
      where('completed_at', '>=', startDate),
      where('completed_at', '<=', endDate),
      orderBy('completed_at', 'asc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  // Em modo de demonstração (Mock)
  return mockDbState.queue.filter(item => 
    item.status === 'done' && 
    item.completed_at >= startDate && 
    item.completed_at <= endDate
  ).sort((a, b) => a.completed_at - b.completed_at);
};
```

---

## 4. Agrupamento e Separação Visual (Frontend)

Criar uma nova view ou componente de relatório (ex: `AdminReport.vue`) contendo:

### A. Lógica de Agrupamento
Agrupar os clientes retornados por barbeiro usando `computed` ou uma função auxiliar:
```typescript
interface GroupedReport {
  [barberName: string]: any[];
}

const groupByBarber = (clients: any[]): GroupedReport => {
  return clients.reduce((acc, client) => {
    const barber = client.assigned_barber_name || 'Profissional Não Definido';
    if (!acc[barber]) acc[barber] = [];
    acc[barber].push(client);
    return acc;
  }, {} as GroupedReport);
};
```

### B. Interface do Relatório (UI)
* **Filtros de Período:** Inputs do tipo `date` para definir a data inicial e final.
* **Resumo:** Total de atendimentos no período.
* **Exibição Agrupada:**
  ```html
  <div v-for="(clients, barberName) in groupedData" :key="barberName" class="barber-report-card">
    <h3>{{ barberName }} ({{ clients.length }} atendimentos)</h3>
    <ul>
      <li v-for="client in clients" :key="client.id">
        <span>{{ client.customer_name }}</span> - 
        <span>{{ formatDateTime(client.completed_at) }}</span>
      </li>
    </ul>
  </div>
  ```
* **Estilos CSS:** Cards com bordas arredondadas e efeito blur glassmorphism coerente com o design do sistema (`src/style.css`).
