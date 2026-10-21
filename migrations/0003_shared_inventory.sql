-- Rental options and packages share physical components.
CREATE TABLE unit_components (
  unit_id TEXT NOT NULL REFERENCES units(id),
  component_id TEXT NOT NULL REFERENCES units(id),
  PRIMARY KEY(unit_id, component_id)
);
CREATE VIEW rental_components AS
  SELECT unit_id, component_id FROM unit_components
  UNION ALL
  SELECT id, id FROM units WHERE NOT EXISTS (SELECT 1 FROM unit_components WHERE unit_id=units.id);
CREATE VIEW conflicting_units AS
  SELECT DISTINCT a.unit_id, b.unit_id AS other_id
  FROM rental_components a JOIN rental_components b USING(component_id);
-- Enforce component conflicts atomically, including concurrent confirmations.
CREATE TRIGGER confirmed_components_insert BEFORE INSERT ON booking_requests
WHEN NEW.status='confirmed'
BEGIN
  SELECT RAISE(ABORT, 'UNIQUE shared inventory conflict') WHERE EXISTS (
    SELECT 1 FROM conflicting_units c JOIN booking_requests r ON r.unit_id=c.other_id
    WHERE c.unit_id=NEW.unit_id AND r.event_date=NEW.event_date AND r.status='confirmed'
  ) OR EXISTS (
    SELECT 1 FROM conflicting_units c JOIN blocks b ON b.unit_id=c.other_id
    WHERE c.unit_id=NEW.unit_id AND b.date=NEW.event_date
  );
END;
CREATE TRIGGER confirmed_components_update BEFORE UPDATE OF status,unit_id,event_date ON booking_requests
WHEN NEW.status='confirmed'
BEGIN
  SELECT RAISE(ABORT, 'UNIQUE shared inventory conflict') WHERE EXISTS (
    SELECT 1 FROM conflicting_units c JOIN booking_requests r ON r.unit_id=c.other_id
    WHERE c.unit_id=NEW.unit_id AND r.id<>NEW.id AND r.event_date=NEW.event_date AND r.status='confirmed'
  ) OR EXISTS (
    SELECT 1 FROM conflicting_units c JOIN blocks b ON b.unit_id=c.other_id
    WHERE c.unit_id=NEW.unit_id AND b.date=NEW.event_date
  );
END;
