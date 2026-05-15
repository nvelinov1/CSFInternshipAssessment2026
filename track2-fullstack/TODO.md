# TODO: Weight Tracking Feature

## Background

Farmers want to track the weight of individual animals over time to monitor growth, detect health issues early, and make informed decisions about feed and veterinary care.

## What to Build

Add a **weight logging** feature to FarmTracker.

### API

Add the following endpoints to the backend:

**Log a weight measurement**
```
POST /animals/{animal_id}/weights
```
Request body:
```json
{
  "weight_kg": 45.2,
  "date": "2024-11-15",
  "notes": "Post-shearing weigh-in"
}
```
Response: the created weight record (201 Created).

**List weight history for an animal**
```
GET /animals/{animal_id}/weights
```
Response: array of weight records, ordered by date descending.

### Frontend

On the animal detail page, add a **Weight History** section that:
- Lists all recorded weights in a simple table (date, weight, notes)
- Includes a form to log a new weight measurement
- Shows the most recent weight prominently (e.g. "Latest: 45.2 kg on 15 Nov 2024")

### Data Model

A weight record should store:
- `id`
- `animal_id` (foreign key)
- `weight_kg` (float, must be positive)
- `date`
- `notes` (optional)

---

## Acceptance Criteria

- [x] `POST /animals/{id}/weights` creates a weight record and returns 201
- [x] `POST /animals/{id}/weights` returns 422 if `weight_kg` is missing or non-positive
- [x] `POST /animals/{id}/weights` returns 404 if the animal does not exist
- [x] `GET /animals/{id}/weights` returns all records ordered by date descending
- [x] Frontend displays weight history and allows logging a new measurement
- [x] Tests cover the happy path and the validation/error cases above
