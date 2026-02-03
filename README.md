Ex Situ: Relational Spatial Index

https://exsitu.app

Ex Situ is a spatial digital commons platform and geospatial infrastructure designed to resolve fragmented cultural heritage metadata into a unified, machine-readable index. By transforming siloed institutional hyperlinks into standardized geospatial data, Ex Situ enables the visualization and analysis of artifact movement across global collections.

Architecture

Ex Situ employs a decoupled architecture designed for high-throughput data resolution and low-latency visualization:

Modular ETL Pipeline: A custom Python-based Extract, Transform, Load (ETL) pipeline that ingests heterogeneous institutional metadata and resolves them into standardized geospatial coordinates.

Headless Backend: Powered by Strapi v4 (Community Edition) on a PostgreSQL/PostGIS database, optimized for complex relational and spatial queries.

High-Performance Frontend: A Next.js application utilizing Deck.gl for large-scale WebGL-based geospatial rendering.

Hosting: Fully deployed on Hetzner to ensure data sovereignty and compliance with open-source digital commons principles.

Scale & Provenance

The infrastructure is built to handle significant institutional data loads:

132,854+ Entries: Successfully resolved and geolocated museum objects from diverse international collections.

Relational Discovery: Functions as a decentralized discovery layer, allowing users to navigate artifacts, geolocated hpyherlinks not just by institution, but by their spatial and historical relationships.

Tech Stack

Frontend	Next.js (App Router), TypeScript, Deck.gl
Styling	Radix UI, Tailwind CSS
Backend	Strapi v4, Node.js
Database	PostgreSQL + PostGIS
Pipeline	Python (Data Normalization & Resolution)
License	MIT License (Open Source)
