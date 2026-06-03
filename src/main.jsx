import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  CircleAlert,
  CircleCheck,
  Building2,
  DoorOpen,
  Eye,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  SlidersHorizontal,
  Search,
  Trash2,
  UserRound,
  WalletCards,
  X
} from "lucide-react";
import "./styles.css";

const STORAGE_KEY = "edificio-app-session";
const PAYMENT_STATUSES = ["PENDING", "PAID", "OVERDUE", "CANCELLED"];
const PAYMENT_EDITABLE_STATUSES = ["PENDING", "PAID", "CANCELLED"];
const PAYMENT_METHODS = ["CASH", "BANK_TRANSFER", "CARD", "YAPE", "PLIN", "OTHER"];
const PAYMENT_CONCEPTS = [
  "Mantenimiento",
  "Agua",
  "Luz de areas comunes",
  "Vigilancia",
  "Limpieza",
  "Multa por atraso",
  "Cuota extraordinaria",
  "Reparacion",
  "Otro"
];
const PAYMENT_STATUS_LABELS = {
  PENDING: "Pendiente",
  PAID: "Pagado",
  OVERDUE: "Vencido",
  CANCELLED: "Anulado"
};
const PAYMENT_METHOD_LABELS = {
  CASH: "Efectivo",
  BANK_TRANSFER: "Transferencia",
  CARD: "Tarjeta",
  YAPE: "Yape",
  PLIN: "Plin",
  OTHER: "Otro"
};

const emptyForms = {
  buildings: { name: "", address: "", district: "", city: "" },
  apartments: { buildingId: "", number: "", floor: 1, areaM2: "", occupied: false },
  residents: {
    apartmentId: "",
    firstName: "",
    lastName: "",
    documentNumber: "",
    email: "",
    phone: "",
    owner: false,
    active: true
  },
  payments: {
    apartmentId: "",
    concept: "Mantenimiento",
    conceptPreset: "Mantenimiento",
    customConcept: "",
    amount: "",
    paidAmount: "",
    dueDate: new Date().toISOString().slice(0, 10),
    paidAt: "",
    paymentMethod: "",
    reference: "",
    status: "PENDING"
  }
};

const emptyFilters = {
  buildings: { district: "", city: "" },
  apartments: { buildingId: "", floor: "", occupied: "all" },
  residents: { buildingId: "", apartmentId: "", role: "all", active: "all" },
  payments: { buildingId: "", apartmentId: "", status: "all", from: "", to: "" }
};

const sections = [
  { id: "overview", label: "Resumen", icon: Building2 },
  { id: "buildings", label: "Edificios", icon: Building2 },
  { id: "apartments", label: "Departamentos", icon: DoorOpen },
  { id: "residents", label: "Residentes", icon: UserRound },
  { id: "payments", label: "Pagos", icon: WalletCards }
];

function App() {
  const [session, setSession] = useState(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  });
  const [active, setActive] = useState("overview");
  const [data, setData] = useState({ buildings: [], apartments: [], residents: [], payments: [] });
  const [forms, setForms] = useState(emptyForms);
  const [filters, setFilters] = useState(emptyFilters);
  const [editDialog, setEditDialog] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [apartmentDetail, setApartmentDetail] = useState(null);
  const [alertDialog, setAlertDialog] = useState(null);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const refreshPromiseRef = useRef(null);

  const api = useMemo(
    () => createApi(session?.accessToken, session?.refreshToken ? refreshSession : null),
    [session?.accessToken, session?.refreshToken]
  );

  useEffect(() => {
    if (session?.accessToken) {
      loadAll();
    }
  }, [session?.accessToken]);

  async function loadAll() {
    setLoading(true);
    setNotice("");
    try {
      const [buildings, apartments, residents, payments] = await Promise.all([
        api.get("/api/buildings"),
        api.get("/api/apartments"),
        api.get("/api/residents"),
        api.get("/api/payments")
      ]);
      setData({ buildings, apartments, residents, payments });
    } catch (error) {
      showError(error);
      if (error.status === 401) clearSession();
    } finally {
      setLoading(false);
    }
  }

  async function login(credentials) {
    setLoading(true);
    setNotice("");
    try {
      const response = await createApi().post("/api/auth/login", credentials);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(response));
      setSession(response);
    } catch (error) {
      showError(error);
    } finally {
      setLoading(false);
    }
  }

  async function refreshSession() {
    if (!session?.refreshToken) {
      clearSession();
      throw new Error("Sesion expirada. Ingresa nuevamente.");
    }

    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    refreshPromiseRef.current = createApi()
      .post("/api/auth/refresh", { refreshToken: session.refreshToken })
      .then((response) => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(response));
        setSession(response);
        return response.accessToken;
      })
      .catch((error) => {
        clearSession();
        throw error;
      })
      .finally(() => {
        refreshPromiseRef.current = null;
      });

    return refreshPromiseRef.current;
  }

  async function logout() {
    const refreshToken = session?.refreshToken;
    if (refreshToken) {
      await createApi()
        .post("/api/auth/logout", { refreshToken })
        .catch(() => null);
    }
    clearSession();
  }

  function clearSession() {
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
    setData({ buildings: [], apartments: [], residents: [], payments: [] });
    setEditDialog(null);
    setDeleteDialog(null);
    setApartmentDetail(null);
  }

  function showSuccess(message) {
    setNotice(message);
    setToast({ type: "success", message });
    window.setTimeout(() => setToast(null), 3000);
  }

  function showError(error) {
    setNotice("");
    setAlertDialog({
      type: "error",
      title: errorTitle(error.status),
      message: error.message || "No se pudo completar la operacion.",
      details: error.details
    });
  }

  function setForm(type, field, value) {
    if (type === "payments") {
      setForms((current) => ({
        ...current,
        payments: updatePaymentForm(current.payments, field, value)
      }));
      return;
    }

    setForms((current) => ({
      ...current,
      [type]: { ...current[type], [field]: value }
    }));
  }

  function setFilter(type, field, value) {
    setFilters((current) => {
      const next = {
        ...current,
        [type]: { ...current[type], [field]: value }
      };

      if (field === "buildingId" && (type === "residents" || type === "payments")) {
        next[type].apartmentId = "";
      }

      return next;
    });
  }

  function resetFilters(type) {
    setFilters((current) => ({ ...current, [type]: emptyFilters[type] }));
  }

  function beginEdit(type, row) {
    setEditDialog({ type, id: row.id, form: normalizeForForm(type, row) });
  }

  function resetForm(type) {
    setForms((current) => ({ ...current, [type]: emptyForms[type] }));
  }

  function setEditField(field, value) {
    setEditDialog((current) => ({
      ...current,
      form: current.type === "payments" ? updatePaymentForm(current.form, field, value) : { ...current.form, [field]: value }
    }));
  }

  async function create(type) {
    const payload = serialize(type, forms[type]);
    setLoading(true);
    setNotice("");
    try {
      await api.post(`/api/${type}`, payload);
      resetForm(type);
      await loadAll();
      showSuccess("Registro creado.");
    } catch (error) {
      showError(error);
    } finally {
      setLoading(false);
    }
  }

  async function update() {
    const { type, id, form } = editDialog;
    const payload = serialize(type, form);
    setLoading(true);
    setNotice("");
    try {
      await api.put(`/api/${type}/${id}`, payload);
      setEditDialog(null);
      await loadAll();
      showSuccess("Cambios guardados.");
    } catch (error) {
      showError(error);
    } finally {
      setLoading(false);
    }
  }

  async function remove(type, id) {
    setLoading(true);
    setNotice("");
    try {
      await api.del(`/api/${type}/${id}`);
      setDeleteDialog(null);
      await loadAll();
      showSuccess("Registro eliminado.");
    } catch (error) {
      showError(error);
    } finally {
      setLoading(false);
    }
  }

  async function markPaymentPaid(payment) {
    const payload = serialize("payments", {
      ...normalizeForForm("payments", payment),
      status: "PAID",
      paidAt: today(),
      paidAmount: payment.amount || 0
    });
    setLoading(true);
    setNotice("");
    try {
      await api.put(`/api/payments/${payment.id}`, payload);
      await loadAll();
      showSuccess("Pago marcado como pagado.");
    } catch (error) {
      showError(error);
    } finally {
      setLoading(false);
    }
  }

  if (!session?.accessToken) {
    return (
      <>
        <LoginScreen onLogin={login} loading={loading} notice={notice} />
        {alertDialog && <AlertDialog alert={alertDialog} onClose={() => setAlertDialog(null)} />}
        {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
      </>
    );
  }

  const stats = getStats(data);
  const visibleBuildings = filterBuildings(data.buildings, query, filters.buildings);
  const visibleApartments = filterApartments(data.apartments, data.buildings, query, filters.apartments);
  const visibleResidents = filterResidents(data.residents, data.apartments, data.buildings, query, filters.residents);
  const visiblePayments = filterPayments(data.payments, data.apartments, data.buildings, query, filters.payments);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">EA</div>
          <div>
            <strong>Edificio App</strong>
            <span>Administracion</span>
          </div>
        </div>
        <nav>
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                className={active === section.id ? "active" : ""}
                onClick={() => setActive(section.id)}
                title={section.label}
              >
                <Icon size={18} />
                <span>{section.label}</span>
              </button>
            );
          })}
        </nav>
        <button className="logout" onClick={logout}>
          <LogOut size={18} />
          <span>Salir</span>
        </button>
      </aside>

      <main>
        <header className="topbar">
          <div>
            <p>Panel operativo</p>
            <h1>{sections.find((section) => section.id === active)?.label}</h1>
          </div>
          <div className="topbar-actions">
            <label className="search">
              <Search size={17} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar" />
            </label>
            <button className="icon-button" onClick={loadAll} title="Actualizar datos">
              <RefreshCw size={18} className={loading ? "spin" : ""} />
            </button>
          </div>
        </header>

        {notice && <div className="notice">{notice}</div>}

        {active === "overview" && <Overview stats={stats} data={data} />}
        {active === "buildings" && (
          <BuildingsPanel
            rows={visibleBuildings}
            buildings={data.buildings}
            filters={filters.buildings}
            form={forms.buildings}
            onChange={(field, value) => setForm("buildings", field, value)}
            onFilter={(field, value) => setFilter("buildings", field, value)}
            onResetFilters={() => resetFilters("buildings")}
            onSave={() => create("buildings")}
            onReset={() => resetForm("buildings")}
            onEdit={(row) => beginEdit("buildings", row)}
            onDelete={(row) =>
              setDeleteDialog({
                type: "buildings",
                id: row.id,
                label: row.name,
                description: buildingDeleteDescription(row, data)
              })
            }
          />
        )}
        {active === "apartments" && (
          <ApartmentsPanel
            rows={visibleApartments}
            buildings={data.buildings}
            filters={filters.apartments}
            form={forms.apartments}
            onChange={(field, value) => setForm("apartments", field, value)}
            onFilter={(field, value) => setFilter("apartments", field, value)}
            onResetFilters={() => resetFilters("apartments")}
            onSave={() => create("apartments")}
            onReset={() => resetForm("apartments")}
            onEdit={(row) => beginEdit("apartments", row)}
            onView={(row) => setApartmentDetail(row)}
            onDelete={(row) =>
              setDeleteDialog({
                type: "apartments",
                id: row.id,
                label: apartmentLabel(row, data.buildings),
                description: apartmentDeleteDescription(row, data)
              })
            }
          />
        )}
        {active === "residents" && (
          <ResidentsPanel
            rows={visibleResidents}
            apartments={data.apartments}
            buildings={data.buildings}
            filters={filters.residents}
            form={forms.residents}
            onChange={(field, value) => setForm("residents", field, value)}
            onFilter={(field, value) => setFilter("residents", field, value)}
            onResetFilters={() => resetFilters("residents")}
            onSave={() => create("residents")}
            onReset={() => resetForm("residents")}
            onEdit={(row) => beginEdit("residents", row)}
            onDelete={(row) => setDeleteDialog({ type: "residents", id: row.id, label: `${row.firstName} ${row.lastName}` })}
          />
        )}
        {active === "payments" && (
          <PaymentsPanel
            rows={visiblePayments}
            apartments={data.apartments}
            buildings={data.buildings}
            filters={filters.payments}
            form={forms.payments}
            onChange={(field, value) => setForm("payments", field, value)}
            onFilter={(field, value) => setFilter("payments", field, value)}
            onResetFilters={() => resetFilters("payments")}
            onSave={() => create("payments")}
            onReset={() => resetForm("payments")}
            onEdit={(row) => beginEdit("payments", row)}
            onDelete={(row) => setDeleteDialog({ type: "payments", id: row.id, label: row.concept })}
            onMarkPaid={markPaymentPaid}
          />
        )}

        {editDialog && (
          <EditModal
            dialog={editDialog}
            data={data}
            loading={loading}
            onChange={setEditField}
            onCancel={() => setEditDialog(null)}
            onSave={update}
          />
        )}

        {deleteDialog && (
          <ConfirmDialog
            item={deleteDialog}
            loading={loading}
            onCancel={() => setDeleteDialog(null)}
            onConfirm={() => remove(deleteDialog.type, deleteDialog.id)}
          />
        )}

        {apartmentDetail && <ApartmentDetailModal apartment={apartmentDetail} data={data} onClose={() => setApartmentDetail(null)} />}

        {alertDialog && <AlertDialog alert={alertDialog} onClose={() => setAlertDialog(null)} />}
        {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
      </main>
    </div>
  );
}

function LoginScreen({ onLogin, loading, notice }) {
  const [credentials, setCredentials] = useState({ username: "", password: "" });

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="login-copy">
          <div className="brand-mark">EA</div>
          <h1>Edificio App</h1>
          <p>Gestion de edificios, departamentos, residentes y pagos desde un solo tablero.</p>
        </div>
        <form
          className="login-form"
          onSubmit={(event) => {
            event.preventDefault();
            onLogin(credentials);
          }}
        >
          <label>
            Usuario
            <input
              value={credentials.username}
              onChange={(event) => setCredentials({ ...credentials, username: event.target.value })}
              autoComplete="username"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={credentials.password}
              onChange={(event) => setCredentials({ ...credentials, password: event.target.value })}
              autoComplete="current-password"
            />
          </label>
          {notice && <div className="notice">{notice}</div>}
          <button className="primary" disabled={loading}>
            Ingresar
          </button>
        </form>
      </section>
    </main>
  );
}

function Overview({ stats, data }) {
  const alerts = operationalAlerts(data);
  const cards = [
    { label: "Edificios", value: stats.buildings, icon: Building2 },
    { label: "Departamentos", value: stats.apartments, icon: DoorOpen },
    { label: "Residentes activos", value: stats.activeResidents, icon: UserRound },
    { label: "Pendiente de cobro", value: formatMoney(stats.pendingAmount), icon: WalletCards }
  ];

  return (
    <section className="overview-grid">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <article className="metric-card" key={card.label}>
            <Icon size={22} />
            <span>{card.label}</span>
            <strong>{card.value}</strong>
          </article>
        );
      })}
      <article className="wide-panel operations-panel">
        <h2>Alertas operativas</h2>
        <div className="operations-list">
          {alerts.map((alert) => (
            <div className={`operation-item ${alert.tone}`} key={alert.label}>
              <strong>{alert.value}</strong>
              <span>{alert.label}</span>
            </div>
          ))}
        </div>
      </article>
      <article className="wide-panel">
        <h2>Pagos recientes</h2>
        <DataTable
          title="Pagos recientes"
          columns={["Concepto", "Monto", "Saldo", "Vence", "Estado"]}
          rows={data.payments.slice(0, 6).map((payment) => [
            payment.concept,
            formatMoney(payment.amount),
            formatMoney(paymentBalance(payment)),
            payment.dueDate,
            <StatusBadge status={effectivePaymentStatus(payment)} />
          ])}
        />
      </article>
      <article className="wide-panel">
        <h2>Ocupacion</h2>
        <div className="occupancy">
          <div style={{ width: `${stats.occupancyRate}%` }} />
        </div>
        <p>{stats.occupancyRate}% de departamentos ocupados</p>
      </article>
    </section>
  );
}

function BuildingsPanel(props) {
  const { rows, buildings, filters, form, onChange, onFilter, onResetFilters, onSave, onReset, onEdit, onDelete } = props;
  const districtOptions = uniqueValues(buildings.map((building) => building.district));
  const cityOptions = uniqueValues(buildings.map((building) => building.city));
  return (
    <CrudLayout title="Nuevo edificio">
      <FormGrid>
        <TextInput label="Nombre" value={form.name} onChange={(value) => onChange("name", value)} />
        <TextInput label="Direccion" value={form.address} onChange={(value) => onChange("address", value)} />
        <TextInput label="Distrito" value={form.district} onChange={(value) => onChange("district", value)} />
        <TextInput label="Ciudad" value={form.city} onChange={(value) => onChange("city", value)} />
      </FormGrid>
      <FormActions onSave={onSave} onReset={onReset} />
      <FilterPanel count={rows.length} onReset={onResetFilters}>
        <SelectInput label="Distrito" value={filters.district} onChange={(value) => onFilter("district", value)}>
          <option value="">Todos</option>
          {districtOptions.map((district) => (
            <option key={district} value={district}>
              {district}
            </option>
          ))}
        </SelectInput>
        <SelectInput label="Ciudad" value={filters.city} onChange={(value) => onFilter("city", value)}>
          <option value="">Todas</option>
          {cityOptions.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </SelectInput>
      </FilterPanel>
      <DataTable
        title="Edificios"
        columns={["Nombre", "Direccion", "Distrito", "Ciudad", "Acciones"]}
        rows={rows.map((row) => [
          row.name,
          row.address,
          row.district || "-",
          row.city || "-",
          <RowActions onEdit={() => onEdit(row)} onDelete={() => onDelete(row)} />
        ])}
      />
    </CrudLayout>
  );
}

function ApartmentsPanel(props) {
  const { rows, buildings, filters, form, onChange, onFilter, onResetFilters, onSave, onReset, onEdit, onView, onDelete } = props;
  return (
    <CrudLayout title="Nuevo departamento">
      <FormGrid>
        <SelectInput label="Edificio" value={form.buildingId} onChange={(value) => onChange("buildingId", value)}>
          <option value="">Selecciona</option>
          {buildings.map((building) => (
            <option key={building.id} value={building.id}>
              {building.name}
            </option>
          ))}
        </SelectInput>
        <TextInput label="Numero" value={form.number} onChange={(value) => onChange("number", value)} />
        <TextInput label="Piso" type="number" value={form.floor} onChange={(value) => onChange("floor", value)} />
        <TextInput label="Area m2" type="number" value={form.areaM2} onChange={(value) => onChange("areaM2", value)} />
        <div className="form-hint">La ocupacion se actualiza automaticamente segun residentes activos.</div>
      </FormGrid>
      <FormActions onSave={onSave} onReset={onReset} />
      <FilterPanel count={rows.length} onReset={onResetFilters}>
        <BuildingFilter value={filters.buildingId} buildings={buildings} onChange={(value) => onFilter("buildingId", value)} />
        <TextInput label="Piso" type="number" value={filters.floor} onChange={(value) => onFilter("floor", value)} />
        <SelectInput label="Estado" value={filters.occupied} onChange={(value) => onFilter("occupied", value)}>
          <option value="all">Todos</option>
          <option value="true">Ocupado</option>
          <option value="false">Libre</option>
        </SelectInput>
      </FilterPanel>
      <DataTable
        title="Departamentos"
        columns={["Numero", "Edificio", "Piso", "Area", "Estado", "Auditoria", "Acciones"]}
        rows={rows.map((row) => [
          row.number,
          buildingName(buildings, row.buildingId),
          row.floor,
          `${row.areaM2 || 0} m2`,
          row.occupied ? "Ocupado" : "Libre",
          <AuditInfo row={row} />,
          <RowActions
            onEdit={() => onEdit(row)}
            onDelete={() => onDelete(row)}
            extra={
              <button className="icon-button" onClick={() => onView(row)} title="Ver detalle">
                <Eye size={16} />
              </button>
            }
          />
        ])}
      />
    </CrudLayout>
  );
}

function ResidentsPanel(props) {
  const { rows, apartments, buildings, filters, form, onChange, onFilter, onResetFilters, onSave, onReset, onEdit, onDelete } = props;
  const selectableApartments = apartmentsForBuilding(apartments, filters.buildingId);
  return (
    <CrudLayout title="Nuevo residente">
      <FormGrid>
        <ApartmentSelect
          label="Departamento"
          value={form.apartmentId}
          apartments={apartments}
          buildings={buildings}
          onChange={(value) => onChange("apartmentId", value)}
        />
        <TextInput label="Nombres" value={form.firstName} onChange={(value) => onChange("firstName", value)} />
        <TextInput label="Apellidos" value={form.lastName} onChange={(value) => onChange("lastName", value)} />
        <TextInput label="Documento" value={form.documentNumber} onChange={(value) => onChange("documentNumber", value)} />
        <TextInput label="Email" type="email" value={form.email} onChange={(value) => onChange("email", value)} />
        <TextInput label="Telefono" value={form.phone} onChange={(value) => onChange("phone", value)} />
        <ToggleInput label="Propietario" checked={form.owner} onChange={(value) => onChange("owner", value)} />
        <ToggleInput label="Activo" checked={form.active} onChange={(value) => onChange("active", value)} />
      </FormGrid>
      <FormActions onSave={onSave} onReset={onReset} />
      <FilterPanel count={rows.length} onReset={onResetFilters}>
        <BuildingFilter value={filters.buildingId} buildings={buildings} onChange={(value) => onFilter("buildingId", value)} />
        <ApartmentSelect
          label="Departamento"
          value={filters.apartmentId}
          apartments={selectableApartments}
          buildings={buildings}
          onChange={(value) => onFilter("apartmentId", value)}
          allowAll
        />
        <SelectInput label="Rol" value={filters.role} onChange={(value) => onFilter("role", value)}>
          <option value="all">Todos</option>
          <option value="owner">Propietario</option>
          <option value="tenant">Inquilino</option>
        </SelectInput>
        <SelectInput label="Estado" value={filters.active} onChange={(value) => onFilter("active", value)}>
          <option value="all">Todos</option>
          <option value="true">Activo</option>
          <option value="false">Inactivo</option>
        </SelectInput>
      </FilterPanel>
      <DataTable
        title="Residentes"
        columns={["Nombre", "Departamento", "Documento", "Contacto", "Rol", "Auditoria", "Acciones"]}
        rows={rows.map((row) => [
          `${row.firstName} ${row.lastName}`,
          apartmentLabelById(apartments, buildings, row.apartmentId),
          row.documentNumber,
          row.email || row.phone || "-",
          row.owner ? "Propietario" : "Inquilino",
          <AuditInfo row={row} />,
          <RowActions onEdit={() => onEdit(row)} onDelete={() => onDelete(row)} />
        ])}
      />
    </CrudLayout>
  );
}

function PaymentsPanel(props) {
  const { rows, apartments, buildings, filters, form, onChange, onFilter, onResetFilters, onSave, onReset, onEdit, onDelete, onMarkPaid } =
    props;
  const selectableApartments = apartmentsForBuilding(apartments, filters.buildingId);
  return (
    <CrudLayout title="Nuevo pago">
      <PaymentForm form={form} apartments={apartments} buildings={buildings} onChange={onChange} />
      <FormActions onSave={onSave} onReset={onReset} />
      <FilterPanel count={rows.length} onReset={onResetFilters}>
        <BuildingFilter value={filters.buildingId} buildings={buildings} onChange={(value) => onFilter("buildingId", value)} />
        <ApartmentSelect
          label="Departamento"
          value={filters.apartmentId}
          apartments={selectableApartments}
          buildings={buildings}
          onChange={(value) => onFilter("apartmentId", value)}
          allowAll
        />
        <SelectInput label="Estado" value={filters.status} onChange={(value) => onFilter("status", value)}>
          <option value="all">Todos</option>
          {PAYMENT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {PAYMENT_STATUS_LABELS[status]}
            </option>
          ))}
        </SelectInput>
        <TextInput label="Desde" type="date" value={filters.from} onChange={(value) => onFilter("from", value)} />
        <TextInput label="Hasta" type="date" value={filters.to} onChange={(value) => onFilter("to", value)} />
      </FilterPanel>
      <DataTable
        title="Pagos"
        columns={["Concepto", "Departamento", "Monto", "Pagado", "Saldo", "Vence", "Estado", "Metodo", "Auditoria", "Acciones"]}
        rows={rows.map((row) => [
          row.concept,
          apartmentLabelById(apartments, buildings, row.apartmentId),
          formatMoney(row.amount),
          formatMoney(paidAmountFor(row)),
          formatMoney(paymentBalance(row)),
          row.dueDate,
          <StatusBadge status={effectivePaymentStatus(row)} />,
          paymentMethodText(row),
          <AuditInfo row={row} />,
          <RowActions
            onEdit={() => onEdit(row)}
            onDelete={() => onDelete(row)}
            extra={
              row.status !== "PAID" && row.status !== "CANCELLED" ? (
                <button className="icon-button success" onClick={() => onMarkPaid(row)} title="Marcar como pagado">
                  <CircleCheck size={16} />
                </button>
              ) : null
            }
          />
        ])}
      />
    </CrudLayout>
  );
}

function PaymentForm({ form, apartments, buildings, onChange }) {
  const isPaid = form.status === "PAID";
  const isOverdue = form.status === "PENDING" && form.dueDate && form.dueDate < today();
  const hasPaymentInfo = isPaid || Number(form.paidAmount || 0) > 0;
  const balance = Math.max(Number(form.amount || 0) - Number(form.paidAmount || 0), 0);
  return (
    <FormGrid>
      <ApartmentSelect
        label="Departamento"
        value={form.apartmentId}
        apartments={apartments}
        buildings={buildings}
        onChange={(value) => onChange("apartmentId", value)}
      />
      <SelectInput label="Concepto" value={form.conceptPreset || conceptPresetFor(form.concept)} onChange={(value) => onChange("conceptPreset", value)}>
        {PAYMENT_CONCEPTS.map((concept) => (
          <option key={concept} value={concept}>
            {concept}
          </option>
        ))}
      </SelectInput>
      {(form.conceptPreset === "Otro" || conceptPresetFor(form.concept) === "Otro") && (
        <TextInput label="Concepto personalizado" value={form.customConcept} onChange={(value) => onChange("customConcept", value)} />
      )}
      <TextInput label="Monto" type="number" value={form.amount} onChange={(value) => onChange("amount", value)} />
      <TextInput label="Monto pagado" type="number" value={form.paidAmount || ""} onChange={(value) => onChange("paidAmount", value)} />
      <TextInput label="Vencimiento" type="date" value={form.dueDate} onChange={(value) => onChange("dueDate", value)} />
      <SelectInput label="Estado" value={form.status} onChange={(value) => onChange("status", value)}>
        {PAYMENT_EDITABLE_STATUSES.map((status) => (
          <option key={status} value={status}>
            {PAYMENT_STATUS_LABELS[status]}
          </option>
        ))}
      </SelectInput>
      {isPaid && <TextInput label="Fecha de pago" type="date" value={form.paidAt || ""} onChange={(value) => onChange("paidAt", value)} />}
      {hasPaymentInfo && (
        <SelectInput label="Metodo de pago" value={form.paymentMethod || ""} onChange={(value) => onChange("paymentMethod", value)}>
          <option value="">Sin registrar</option>
          {PAYMENT_METHODS.map((method) => (
            <option key={method} value={method}>
              {PAYMENT_METHOD_LABELS[method]}
            </option>
          ))}
        </SelectInput>
      )}
      {hasPaymentInfo && <TextInput label="Referencia / operacion" value={form.reference || ""} onChange={(value) => onChange("reference", value)} />}
      {Number(form.paidAmount || 0) > 0 && balance > 0 && <div className="form-hint warning">Pago parcial: queda un saldo de {formatMoney(balance)}.</div>}
      {isOverdue && <div className="form-hint warning">Este pago se mostrara como vencido porque la fecha de vencimiento ya paso.</div>}
      {!isPaid && <div className="form-hint">La fecha de pago se registra solo cuando el estado es pagado.</div>}
    </FormGrid>
  );
}

function EditModal({ dialog, data, loading, onChange, onCancel, onSave }) {
  const titles = {
    buildings: "Editar edificio",
    apartments: "Editar departamento",
    residents: "Editar residente",
    payments: "Editar pago"
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal" role="dialog" aria-modal="true" aria-label={titles[dialog.type]}>
        <div className="modal-header">
          <div>
            <span>Editar registro</span>
            <h2>{titles[dialog.type]}</h2>
          </div>
          <button className="icon-button" onClick={onCancel} title="Cerrar">
            <X size={17} />
          </button>
        </div>
        <EntityForm type={dialog.type} form={dialog.form} data={data} onChange={onChange} />
        <div className="modal-actions">
          <button className="secondary" onClick={onCancel}>
            Cancelar
          </button>
          <button className="primary" onClick={onSave} disabled={loading}>
            <Save size={17} />
            <span>Guardar cambios</span>
          </button>
        </div>
      </section>
    </div>
  );
}

function ApartmentDetailModal({ apartment, data, onClose }) {
  const residents = data.residents.filter((resident) => sameId(resident.apartmentId, apartment.id));
  const payments = data.payments.filter((payment) => sameId(payment.apartmentId, apartment.id));
  const pendingBalance = payments
    .filter((payment) => payment.status !== "PAID" && payment.status !== "CANCELLED")
    .reduce((sum, payment) => sum + paymentBalance(payment), 0);

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal detail-modal" role="dialog" aria-modal="true" aria-label="Detalle de departamento">
        <div className="modal-header">
          <div>
            <span>{buildingName(data.buildings, apartment.buildingId)}</span>
            <h2>Dpto {apartment.number}</h2>
          </div>
          <button className="icon-button" onClick={onClose} title="Cerrar">
            <X size={17} />
          </button>
        </div>

        <div className="detail-metrics">
          <div>
            <span>Estado</span>
            <strong>{apartment.occupied ? "Ocupado" : "Libre"}</strong>
          </div>
          <div>
            <span>Residentes activos</span>
            <strong>{residents.filter((resident) => resident.active).length}</strong>
          </div>
          <div>
            <span>Saldo pendiente</span>
            <strong>{formatMoney(pendingBalance)}</strong>
          </div>
        </div>

        <section className="detail-section">
          <h3>Residentes</h3>
          <DataTable
            title={`Residentes - Dpto ${apartment.number}`}
            columns={["Nombre", "Documento", "Contacto", "Rol", "Estado"]}
            rows={residents.map((resident) => [
              `${resident.firstName} ${resident.lastName}`,
              resident.documentNumber,
              resident.email || resident.phone || "-",
              resident.owner ? "Propietario" : "Inquilino",
              resident.active ? "Activo" : "Inactivo"
            ])}
          />
        </section>

        <section className="detail-section">
          <h3>Pagos</h3>
          <DataTable
            title={`Pagos - Dpto ${apartment.number}`}
            columns={["Concepto", "Monto", "Pagado", "Saldo", "Vence", "Estado"]}
            rows={payments.map((payment) => [
              payment.concept,
              formatMoney(payment.amount),
              formatMoney(paidAmountFor(payment)),
              formatMoney(paymentBalance(payment)),
              payment.dueDate,
              <StatusBadge status={effectivePaymentStatus(payment)} />
            ])}
          />
        </section>
      </section>
    </div>
  );
}

function ConfirmDialog({ item, loading, onCancel, onConfirm }) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="confirm-modal" role="dialog" aria-modal="true" aria-label="Confirmar eliminacion">
        <h2>Eliminar registro</h2>
        <p>
          Se eliminara <strong>{item.label}</strong>. Esta accion no se puede deshacer.
        </p>
        {item.description && <div className="dependency-note">{item.description}</div>}
        <div className="modal-actions">
          <button className="secondary" onClick={onCancel}>
            Cancelar
          </button>
          <button className="danger-button" onClick={onConfirm} disabled={loading}>
            <Trash2 size={17} />
            <span>Eliminar</span>
          </button>
        </div>
      </section>
    </div>
  );
}

function AlertDialog({ alert, onClose }) {
  const Icon = CircleAlert;
  const details = alert.details ? Object.entries(alert.details) : [];

  return (
    <div className="modal-backdrop alert-layer" role="presentation">
      <section className={`alert-modal ${alert.type}`} role="alertdialog" aria-modal="true" aria-label={alert.title}>
        <div className="alert-icon">
          <Icon size={24} />
        </div>
        <div className="alert-content">
          <h2>{alert.title}</h2>
          <p>{alert.message}</p>
          {details.length > 0 && (
            <ul className="alert-details">
              {details.map(([field, message]) => (
                <li key={field}>
                  <strong>{field}:</strong> {message}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="alert-actions">
          <button className={alert.type === "success" ? "primary" : "secondary"} onClick={onClose}>
            Entendido
          </button>
        </div>
      </section>
    </div>
  );
}

function Toast({ toast, onClose }) {
  return (
    <div className={`toast ${toast.type}`} role="status">
      <CircleCheck size={20} />
      <span>{toast.message}</span>
      <button onClick={onClose} title="Cerrar">
        <X size={15} />
      </button>
    </div>
  );
}

function EntityForm({ type, form, data, onChange }) {
  if (type === "buildings") {
    return (
      <FormGrid>
        <TextInput label="Nombre" value={form.name} onChange={(value) => onChange("name", value)} />
        <TextInput label="Direccion" value={form.address} onChange={(value) => onChange("address", value)} />
        <TextInput label="Distrito" value={form.district} onChange={(value) => onChange("district", value)} />
        <TextInput label="Ciudad" value={form.city} onChange={(value) => onChange("city", value)} />
      </FormGrid>
    );
  }

  if (type === "apartments") {
    return (
      <FormGrid>
        <SelectInput label="Edificio" value={form.buildingId} onChange={(value) => onChange("buildingId", value)}>
          <option value="">Selecciona</option>
          {data.buildings.map((building) => (
            <option key={building.id} value={building.id}>
              {building.name}
            </option>
          ))}
        </SelectInput>
        <TextInput label="Numero" value={form.number} onChange={(value) => onChange("number", value)} />
        <TextInput label="Piso" type="number" value={form.floor} onChange={(value) => onChange("floor", value)} />
        <TextInput label="Area m2" type="number" value={form.areaM2} onChange={(value) => onChange("areaM2", value)} />
        <div className="form-hint">La ocupacion se actualiza automaticamente segun residentes activos.</div>
      </FormGrid>
    );
  }

  if (type === "residents") {
    return (
      <FormGrid>
        <ApartmentSelect
          label="Departamento"
          value={form.apartmentId}
          apartments={data.apartments}
          buildings={data.buildings}
          onChange={(value) => onChange("apartmentId", value)}
        />
        <TextInput label="Nombres" value={form.firstName} onChange={(value) => onChange("firstName", value)} />
        <TextInput label="Apellidos" value={form.lastName} onChange={(value) => onChange("lastName", value)} />
        <TextInput label="Documento" value={form.documentNumber} onChange={(value) => onChange("documentNumber", value)} />
        <TextInput label="Email" type="email" value={form.email} onChange={(value) => onChange("email", value)} />
        <TextInput label="Telefono" value={form.phone} onChange={(value) => onChange("phone", value)} />
        <ToggleInput label="Propietario" checked={form.owner} onChange={(value) => onChange("owner", value)} />
        <ToggleInput label="Activo" checked={form.active} onChange={(value) => onChange("active", value)} />
      </FormGrid>
    );
  }

  return (
    <PaymentForm form={form} apartments={data.apartments} buildings={data.buildings} onChange={onChange} />
  );
}

function CrudLayout({ title, children }) {
  const content = React.Children.toArray(children);
  return (
    <section className="crud-layout">
      <article className="form-panel">
        <h2>{title}</h2>
        {content.slice(0, 2)}
      </article>
      <article className="table-panel">{content.slice(2)}</article>
    </section>
  );
}

function FormGrid({ children }) {
  return <div className="form-grid">{children}</div>;
}

function TextInput({ label, value, onChange, type = "text" }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type={type} value={value ?? ""} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SelectInput({ label, value, onChange, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value ?? ""} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </label>
  );
}

function BuildingFilter({ value, buildings, onChange }) {
  return (
    <SelectInput label="Edificio" value={value} onChange={onChange}>
      <option value="">Todos</option>
      {buildings.map((building) => (
        <option key={building.id} value={building.id}>
          {building.name}
        </option>
      ))}
    </SelectInput>
  );
}

function ApartmentSelect({ label, value, apartments, buildings, onChange, allowAll = false }) {
  const groups = buildings
    .map((building) => ({
      building,
      apartments: apartments.filter((apartment) => apartment.buildingId === building.id)
    }))
    .filter((group) => group.apartments.length > 0);

  const orphanApartments = apartments.filter((apartment) => !buildings.some((building) => building.id === apartment.buildingId));

  return (
    <SelectInput label={label} value={value} onChange={onChange}>
      <option value="">{allowAll ? "Todos" : "Selecciona"}</option>
      {groups.map((group) => (
        <optgroup key={group.building.id} label={group.building.name}>
          {group.apartments.map((apartment) => (
            <option key={apartment.id} value={apartment.id}>
              {apartmentOptionText(apartment, buildings)}
            </option>
          ))}
        </optgroup>
      ))}
      {orphanApartments.map((apartment) => (
        <option key={apartment.id} value={apartment.id}>
          {apartmentLabel(apartment, buildings)}
        </option>
      ))}
    </SelectInput>
  );
}

function FilterPanel({ children, count, onReset }) {
  return (
    <section className="filters-panel">
      <div className="filters-header">
        <div>
          <span>
            <SlidersHorizontal size={15} />
            Filtros
          </span>
          <strong>{count} registros</strong>
        </div>
        <button className="text-button" onClick={onReset}>
          Limpiar filtros
        </button>
      </div>
      <div className="filters-grid">{children}</div>
    </section>
  );
}

function ToggleInput({ label, checked, onChange }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={Boolean(checked)} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function FormActions({ onSave, onReset }) {
  return (
    <div className="form-actions">
      <button className="primary" onClick={onSave}>
        <Plus size={17} />
        <span>Crear</span>
      </button>
      <button className="secondary" onClick={onReset}>
        Limpiar
      </button>
    </div>
  );
}

function DataTable({ columns, rows, title = "Reporte" }) {
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const pageCount = Math.max(Math.ceil(rows.length / pageSize), 1);
  const safePage = Math.min(page, pageCount);
  const visibleRows = rows.slice((safePage - 1) * pageSize, safePage * pageSize);
  const report = reportData(columns, rows);

  function exportCsv() {
    const csv = [
      ["Reporte", title],
      ["Generado", formatDateTime(new Date().toISOString())],
      ["Registros", report.rows.length],
      [],
      report.columns,
      ...report.rows
    ]
      .map((row) => row.map(escapeCsv).join(";"))
      .join("\r\n");
    const blob = new Blob([`\ufeffsep=;\r\n${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${reportFileName(title)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportPdf() {
    const popup = window.open("", "_blank");
    if (!popup) return;
    popup.document.write(reportHtml(title, report));
    popup.document.close();
    popup.focus();
    window.setTimeout(() => popup.print(), 250);
  }

  return (
    <div className="table-shell">
      <div className="table-toolbar">
        <span>
          {rows.length} registro{rows.length === 1 ? "" : "s"}
        </span>
        <div className="table-export-actions">
          <button className="secondary compact" onClick={exportCsv} disabled={!rows.length}>
            Exportar CSV
          </button>
          <button className="secondary compact" onClick={exportPdf} disabled={!rows.length}>
            Exportar PDF
          </button>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              visibleRows.map((row, index) => (
                <tr key={`${safePage}-${index}`}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex}>{cell}</td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="empty">
                  Sin registros
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {rows.length > pageSize && (
        <div className="pagination">
          <button className="secondary compact" onClick={() => setPage((current) => Math.max(current - 1, 1))} disabled={safePage === 1}>
            Anterior
          </button>
          <span>
            Pagina {safePage} de {pageCount}
          </span>
          <button className="secondary compact" onClick={() => setPage((current) => Math.min(current + 1, pageCount))} disabled={safePage === pageCount}>
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
}

function RowActions({ onEdit, onDelete, extra }) {
  return (
    <div className="row-actions">
      {extra}
      <button className="icon-button" onClick={onEdit} title="Editar">
        <Pencil size={16} />
      </button>
      <button className="icon-button danger" onClick={onDelete} title="Eliminar">
        <Trash2 size={16} />
      </button>
    </div>
  );
}

function AuditInfo({ row }) {
  const edited = row.updatedBy || row.updatedAt;
  return (
    <div className="audit-info">
      <span>Creado por {row.createdBy || "system"}</span>
      <small>{formatDateTime(row.createdAt)}</small>
      {edited && (
        <>
          <span>Editado por {row.updatedBy || "-"}</span>
          <small>{formatDateTime(row.updatedAt)}</small>
        </>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  return <span className={`status ${status?.toLowerCase()}`}>{PAYMENT_STATUS_LABELS[status] || status}</span>;
}

function createApi(token, onRefresh) {
  async function request(path, options = {}) {
    const response = await fetch(path, buildOptions(options, token));

    if (response.status === 401 && onRefresh && !options.skipRefresh) {
      const refreshedToken = await onRefresh();
      const retryResponse = await fetch(path, buildOptions({ ...options, skipRefresh: true }, refreshedToken));
      return parseResponse(retryResponse);
    }

    return parseResponse(response);
  }

  function buildOptions(options, requestToken) {
    const { skipRefresh, ...fetchOptions } = options;
    return {
      ...fetchOptions,
      headers: {
        "Content-Type": "application/json",
        ...(requestToken ? { Authorization: `Bearer ${requestToken}` } : {}),
        ...options.headers
      }
    };
  }

  async function parseResponse(response) {
    if (response.status === 204) return null;
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message = payload?.message || payload?.error || "No se pudo completar la operacion.";
      const error = new Error(message);
      error.status = response.status;
      error.details = payload?.validationErrors || null;
      throw error;
    }
    return payload;
  }

  return {
    get: (path) => request(path),
    post: (path, body) => request(path, { method: "POST", body: JSON.stringify(body) }),
    put: (path, body) => request(path, { method: "PUT", body: JSON.stringify(body) }),
    del: (path) => request(path, { method: "DELETE" })
  };
}

function serialize(type, form) {
  if (type === "buildings") return form;
  if (type === "apartments") {
    return {
      ...form,
      buildingId: Number(form.buildingId),
      floor: Number(form.floor),
      areaM2: Number(form.areaM2),
      occupied: Boolean(form.occupied)
    };
  }
  if (type === "residents") {
    return {
      ...form,
      apartmentId: Number(form.apartmentId),
      owner: Boolean(form.owner),
      active: Boolean(form.active)
    };
  }
  const { conceptPreset, customConcept, ...payment } = form;
  return {
    ...payment,
    apartmentId: Number(form.apartmentId),
    amount: Number(form.amount),
    paidAmount: Number(form.paidAmount || 0),
    concept: paymentConcept(form),
    paidAt: form.status === "PAID" ? form.paidAt || today() : null
  };
}

function normalizeForForm(type, row) {
  if (type === "payments") {
    const preset = conceptPresetFor(row.concept);
    return {
      ...row,
      status: row.status === "OVERDUE" ? "PENDING" : row.status,
      conceptPreset: preset,
      customConcept: preset === "Otro" ? row.concept : "",
      paidAmount: row.paidAmount || "",
      paidAt: row.paidAt || ""
    };
  }
  return { ...row };
}

function getStats(data) {
  const occupied = data.apartments.filter((apartment) => apartment.occupied).length;
  const pendingAmount = data.payments
    .filter((payment) => payment.status === "PENDING" || payment.status === "OVERDUE")
    .reduce((sum, payment) => sum + paymentBalance(payment), 0);

  return {
    buildings: data.buildings.length,
    apartments: data.apartments.length,
    activeResidents: data.residents.filter((resident) => resident.active).length,
    pendingAmount,
    occupancyRate: data.apartments.length ? Math.round((occupied / data.apartments.length) * 100) : 0
  };
}

function operationalAlerts(data) {
  const todayDate = today();
  const nextWeek = addDays(todayDate, 7);
  const activePayments = data.payments.filter((payment) => payment.status !== "PAID" && payment.status !== "CANCELLED");
  const overdue = activePayments.filter((payment) => effectivePaymentStatus(payment) === "OVERDUE");
  const dueSoon = activePayments.filter((payment) => payment.dueDate >= todayDate && payment.dueDate <= nextWeek);
  const partial = activePayments.filter((payment) => Number(payment.paidAmount || 0) > 0 && paymentBalance(payment) > 0);
  const freeApartments = data.apartments.filter((apartment) => !apartment.occupied);

  return [
    { label: "pagos vencidos", value: overdue.length, tone: overdue.length ? "danger" : "neutral" },
    { label: "vencen en 7 dias", value: dueSoon.length, tone: dueSoon.length ? "warning" : "neutral" },
    { label: "pagos parciales", value: partial.length, tone: partial.length ? "warning" : "neutral" },
    { label: "departamentos libres", value: freeApartments.length, tone: "neutral" }
  ];
}

function formatMoney(value) {
  return new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(Number(value || 0));
}

function paymentBalance(payment) {
  return Math.max(Number(payment.amount || 0) - paidAmountFor(payment), 0);
}

function paidAmountFor(payment) {
  if ((payment.paidAmount == null || payment.paidAmount === "") && payment.status === "PAID") {
    return Number(payment.amount || 0);
  }
  return Number(payment.paidAmount || 0);
}

function paymentMethodText(payment) {
  if (!payment.paymentMethod && !payment.reference) return "-";
  return [PAYMENT_METHOD_LABELS[payment.paymentMethod] || payment.paymentMethod, payment.reference].filter(Boolean).join(" / ");
}

function reportData(columns, rows) {
  const includedIndexes = columns.map((column, index) => ({ column, index })).filter((item) => item.column !== "Acciones");
  return {
    columns: includedIndexes.map((item) => item.column),
    rows: rows.map((row) => includedIndexes.map((item) => cellToText(row[item.index])))
  };
}

function cellToText(cell) {
  if (cell == null) return "";
  if (typeof cell === "string" || typeof cell === "number" || typeof cell === "boolean") return String(cell);
  if (React.isValidElement(cell)) {
    if (cell.type === StatusBadge) return PAYMENT_STATUS_LABELS[cell.props.status] || cell.props.status || "";
    if (cell.type === AuditInfo) {
      const row = cell.props.row || {};
      const created = `Creado por ${row.createdBy || "system"}${row.createdAt ? ` el ${formatDateTime(row.createdAt)}` : ""}`;
      const edited = row.updatedBy || row.updatedAt ? `Editado por ${row.updatedBy || "-"}${row.updatedAt ? ` el ${formatDateTime(row.updatedAt)}` : ""}` : "";
      return [created, edited].filter(Boolean).join(" | ");
    }
    return "";
  }
  return String(cell);
}

function escapeCsv(value) {
  const text = String(value ?? "");
  return /[";\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function reportFileName(title) {
  return `edificio-app-${normalize(title).replaceAll(" ", "-") || "reporte"}-${today()}`;
}

function reportHtml(title, report) {
  const generatedAt = formatDateTime(new Date().toISOString());
  const header = report.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("");
  const body = report.rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
    .join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { margin: 18mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #20332b; font-family: Arial, sans-serif; }
    header { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; margin-bottom: 20px; padding-bottom: 14px; border-bottom: 2px solid #2f826d; }
    h1 { margin: 0 0 6px; font-size: 24px; }
    p { margin: 0; color: #5d6c66; font-size: 12px; }
    .meta { text-align: right; }
    .summary { display: inline-block; margin-top: 8px; padding: 7px 10px; border-radius: 6px; background: #edf6f2; color: #225f50; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { background: #20332b; color: #ffffff; text-align: left; }
    th, td { padding: 8px 7px; border: 1px solid #d9e3df; vertical-align: top; }
    tbody tr:nth-child(even) { background: #f7fbfa; }
    footer { margin-top: 18px; color: #7a8781; font-size: 10px; text-align: right; }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>${escapeHtml(title)}</h1>
      <p>Edificio App</p>
      <span class="summary">${report.rows.length} registro${report.rows.length === 1 ? "" : "s"}</span>
    </div>
    <div class="meta">
      <p>Generado</p>
      <strong>${escapeHtml(generatedAt)}</strong>
    </div>
  </header>
  <table>
    <thead><tr>${header}</tr></thead>
    <tbody>${body}</tbody>
  </table>
  <footer>Reporte generado desde Edificio App</footer>
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function updatePaymentForm(form, field, value) {
  const next = { ...form, [field]: value };
  if (field === "conceptPreset") {
    next.concept = value === "Otro" ? next.customConcept : value;
  }
  if (field === "customConcept") {
    next.concept = next.conceptPreset === "Otro" ? value : next.concept;
  }
  if (field === "status") {
    if (value === "PAID" && !next.paidAt) {
      next.paidAt = today();
    }
    if (value === "PAID" && !Number(next.paidAmount || 0)) {
      next.paidAmount = next.amount || "";
    }
    if (value !== "PAID") {
      next.paidAt = "";
    }
  }
  if (field === "amount" && next.status === "PAID" && !Number(next.paidAmount || 0)) {
    next.paidAmount = value;
  }
  return next;
}

function paymentConcept(form) {
  if (form.conceptPreset === "Otro") {
    return String(form.customConcept || "").trim();
  }
  return form.conceptPreset || form.concept;
}

function conceptPresetFor(concept) {
  return PAYMENT_CONCEPTS.includes(concept) ? concept : "Otro";
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(date, days) {
  const value = new Date(`${date}T00:00:00`);
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function buildingName(buildings, id) {
  return buildings.find((building) => sameId(building.id, id))?.name || `Edificio #${id}`;
}

function apartmentLabelById(apartments, buildings, id) {
  const apartment = apartments.find((item) => sameId(item.id, id));
  return apartment ? apartmentLabel(apartment, buildings) : `Departamento #${id}`;
}

function apartmentLabel(apartment, buildings) {
  return `${buildingName(buildings, apartment.buildingId)} / Dpto ${apartment.number} / Piso ${apartment.floor}`;
}

function apartmentOptionText(apartment, buildings) {
  return `${buildingName(buildings, apartment.buildingId)} - Dpto ${apartment.number} - Piso ${apartment.floor}${
    apartment.occupied ? " - Ocupado" : " - Libre"
  }`;
}

function apartmentsForBuilding(apartments, buildingId) {
  if (!buildingId) return apartments;
  return apartments.filter((apartment) => sameId(apartment.buildingId, buildingId));
}

function filterBuildings(buildings, query, filters) {
  const needle = normalize(query);
  return buildings.filter((building) => {
    const matchesSearch = matchesNeedle(needle, [building.name, building.address, building.district, building.city]);
    const matchesDistrict = !filters.district || normalize(building.district).includes(normalize(filters.district));
    const matchesCity = !filters.city || normalize(building.city).includes(normalize(filters.city));
    return matchesSearch && matchesDistrict && matchesCity;
  });
}

function filterApartments(apartments, buildings, query, filters) {
  const needle = normalize(query);
  return apartments.filter((apartment) => {
    const matchesSearch = matchesNeedle(needle, [
      apartment.number,
      apartment.floor,
      apartment.areaM2,
      apartment.occupied ? "ocupado" : "libre",
      buildingName(buildings, apartment.buildingId)
    ]);
    const matchesBuilding = !filters.buildingId || sameId(apartment.buildingId, filters.buildingId);
    const matchesFloor = filters.floor === "" || Number(apartment.floor) === Number(filters.floor);
    const matchesOccupied = filters.occupied === "all" || String(apartment.occupied) === filters.occupied;
    return matchesSearch && matchesBuilding && matchesFloor && matchesOccupied;
  });
}

function filterResidents(residents, apartments, buildings, query, filters) {
  const needle = normalize(query);
  return residents.filter((resident) => {
    const apartment = apartments.find((item) => sameId(item.id, resident.apartmentId));
    const matchesSearch = matchesNeedle(needle, [
      resident.firstName,
      resident.lastName,
      resident.documentNumber,
      resident.email,
      resident.phone,
      resident.owner ? "propietario" : "inquilino",
      resident.active ? "activo" : "inactivo",
      apartment?.number,
      apartment ? buildingName(buildings, apartment.buildingId) : ""
    ]);
    const matchesBuilding = !filters.buildingId || (apartment && sameId(apartment.buildingId, filters.buildingId));
    const matchesApartment = !filters.apartmentId || sameId(resident.apartmentId, filters.apartmentId);
    const matchesRole =
      filters.role === "all" || (filters.role === "owner" && resident.owner) || (filters.role === "tenant" && !resident.owner);
    const matchesActive = filters.active === "all" || String(resident.active) === filters.active;
    return matchesSearch && matchesBuilding && matchesApartment && matchesRole && matchesActive;
  });
}

function filterPayments(payments, apartments, buildings, query, filters) {
  const needle = normalize(query);
  return payments.filter((payment) => {
    const apartment = apartments.find((item) => sameId(item.id, payment.apartmentId));
    const matchesSearch = matchesNeedle(needle, [
      payment.concept,
      payment.amount,
      payment.dueDate,
      payment.paidAt,
      payment.status,
      apartment?.number,
      apartment ? buildingName(buildings, apartment.buildingId) : ""
    ]);
    const matchesBuilding = !filters.buildingId || (apartment && sameId(apartment.buildingId, filters.buildingId));
    const matchesApartment = !filters.apartmentId || sameId(payment.apartmentId, filters.apartmentId);
    const matchesStatus = filters.status === "all" || effectivePaymentStatus(payment) === filters.status;
    const matchesFrom = !filters.from || payment.dueDate >= filters.from;
    const matchesTo = !filters.to || payment.dueDate <= filters.to;
    return matchesSearch && matchesBuilding && matchesApartment && matchesStatus && matchesFrom && matchesTo;
  });
}

function effectivePaymentStatus(payment) {
  if (payment.status === "PENDING" && payment.dueDate && payment.dueDate < today()) {
    return "OVERDUE";
  }
  return payment.status;
}

function matchesNeedle(needle, values) {
  if (!needle) return true;
  return values.some((value) => normalize(value).includes(needle));
}

function normalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function sameId(a, b) {
  return Number(a) === Number(b);
}

function errorTitle(status) {
  if (status === 400) return "Revisa los datos";
  if (status === 401) return "Sesion o credenciales invalidas";
  if (status === 403) return "Acceso no permitido";
  if (status === 404) return "Registro no encontrado";
  if (status === 409) return "Conflicto de datos";
  if (status === 429) return "Demasiados intentos";
  if (status >= 500) return "Error del servidor";
  return "No se pudo completar";
}

function uniqueValues(values) {
  return [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "es")
  );
}

function buildingDeleteDescription(building, data) {
  const apartments = data.apartments.filter((apartment) => sameId(apartment.buildingId, building.id));
  if (apartments.length === 0) {
    return "No se detectan departamentos activos asociados a este edificio.";
  }
  const apartmentIds = apartments.map((apartment) => Number(apartment.id));
  const residents = data.residents.filter((resident) => apartmentIds.includes(Number(resident.apartmentId))).length;
  const payments = data.payments.filter((payment) => apartmentIds.includes(Number(payment.apartmentId))).length;
  return `Este edificio tiene ${apartments.length} departamento(s), ${residents} residente(s) y ${payments} pago(s) asociados. Para eliminarlo, primero elimina esos registros relacionados.`;
}

function apartmentDeleteDescription(apartment, data) {
  const residents = data.residents.filter((resident) => sameId(resident.apartmentId, apartment.id)).length;
  const payments = data.payments.filter((payment) => sameId(payment.apartmentId, apartment.id)).length;
  if (residents === 0 && payments === 0) {
    return "No se detectan residentes ni pagos activos asociados a este departamento.";
  }
  return `Este departamento tiene ${residents} residente(s) y ${payments} pago(s) activos. Para eliminarlo, primero elimina esos registros relacionados.`;
}

const rootElement = document.getElementById("root");
const root = window.__edificioRoot ?? createRoot(rootElement);
window.__edificioRoot = root;
root.render(<App />);
