CREATE DATABASE IF NOT EXISTS `factory-erp`;
USE `factory-erp`;

CREATE TABLE IF NOT EXISTS buyer (
  id INT(11) NOT NULL AUTO_INCREMENT,
  name TEXT NOT NULL,
  company TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  country TEXT NOT NULL,
  status ENUM('active', 'inactive') NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

INSERT INTO buyer (name, company, email, phone, address, country, status)
SELECT 'John Smith', 'ABC Corp', 'john@abc.com', '+1-234-5678', 'New York Office', 'USA', 'active'
WHERE NOT EXISTS (SELECT 1 FROM buyer WHERE email = 'john@abc.com');

INSERT INTO buyer (name, company, email, phone, address, country, status)
SELECT 'Sarah Johnson', 'XYZ Ltd', 'sarah@xyz.com', '+1-234-5679', 'London Office', 'UK', 'active'
WHERE NOT EXISTS (SELECT 1 FROM buyer WHERE email = 'sarah@xyz.com');

INSERT INTO buyer (name, company, email, phone, address, country, status)
SELECT 'Michael Chen', 'DEF Inc', 'michael@def.com', '+1-234-5680', 'Singapore Office', 'Singapore', 'inactive'
WHERE NOT EXISTS (SELECT 1 FROM buyer WHERE email = 'michael@def.com');
