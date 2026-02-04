# Ex Situ: Relational Spatial Index

[**ExSitu.app**](https://exsitu.app)

**Ex Situ** is a high-performance geospatial infrastructure designed to resolve fragmented cultural heritage metadata into a unified, machine-readable **Spatial Digital Commons**. 

By transforming siloed institutional hyperlinks into standardized geospatial data, Ex Situ enables the visualization and analysis of artifact displacement through a decentralized discovery layer.

---

## System Architecture

Ex Situ employs a decoupled, scalable architecture designed for high-volume data resolution:

* **Relational Index Engine (ETL):** A modular Python-based pipeline that ingests heterogeneous metadata, performing fuzzy geocoding and provenance resolution into precise spatial coordinates.
* **Spatial Backend:** A **PostGIS**-enabled database optimized for multilevel spatial aggregation and complex relational queries.
* **Visualization Layer:** A **Next.js** application utilizing **Deck.gl** and **MapLibre GL JS** for GPU-accelerated rendering of massive datasets and provenance arcs.
* **Autonomous Infrastructure:** Fully self-hosted on independent bare-metal servers (Hetzner) to ensure data sovereignty and resistance to proprietary platform enclosure.

---

## Scale & Provenance

* **132,854+ Resolved Entries:** Successfully geolocated museum objects whose provenance spans 177 countries, primarily held in collections based in Germany and New York.
* **Spatial Search Logic:** Moving beyond keyword-based search toward a model where cultural heritage is discovered through geographic and historical relationships.
* **Interoperability:** Engineered to "resolve" non-standardized metadata across diverse institutional web domains into a unified schema.

---

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | Next.js (App Router), TypeScript, Radix UI |
| **Mapping** | MapLibre GL JS & Deck.gl (WebGL/WebGPU) |
| **Backend** | Strapi v4 (Headless CMS), Node.js |
| **Database** | PostgreSQL + PostGIS + H3 Indexing |
| **Processing** | Python (GeoPandas, Nominatim, Custom ETL) |
| **License** | **GNU AGPLv3** |

---

## Licensing & The Spatial Digital Commons

Ex Situ is committed to the principles of open-knowledge and digital autonomy. To protect the project from proprietary enclosure, it is licensed under the **GNU Affero General Public License v3 (AGPLv3)**.

**Why AGPLv3?**

* **Transparency:** Any enhancements to the core engine must be shared back with the community.
* **Anti-Siloing:** Prevents the "SaaS loophole" where the software is used to build closed, private platforms.
* **Data Sovereignty:** Ensures that the infrastructure connecting our global heritage remains open and interoperable.

---

### Note on Development
Ex Situ is currently transitioning its mapping engine to **MapLibre GL JS** to ensure a 100% open-source stack, free from proprietary "pay-per-load" dependencies and maintaining full data sovereignty.
