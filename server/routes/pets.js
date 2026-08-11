const express = require('express');
const router = express.Router();
const Pet = require('../models/Pet');
const { protect, restrictTo } = require('../middleware/auth');

const customerOnly = [protect, restrictTo('customer')];

// GET /api/pets — get all pets for logged-in customer
router.get('/', ...customerOnly, async (req, res) => {
  try {
    const pets = await Pet.find({ owner: req.user.id }).sort({ name: 1 });
    res.json(pets);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/pets — add a new pet
router.post('/', ...customerOnly, async (req, res) => {
  const { name, breed, size, notes, photo } = req.body;
  try {
    const existing = await Pet.findOne({ owner: req.user.id, name: { $regex: new RegExp(`^${name}$`, 'i') } });
    if (existing) {
      return res.status(409).json({ message: `You already have a pet named "${existing.name}". Remove it first or use a different name.` });
    }
    const pet = await Pet.create({ owner: req.user.id, name, breed, size, notes, photo });
    res.status(201).json(pet);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/pets/:id — update a pet
router.put('/:id', ...customerOnly, async (req, res) => {
  try {
    if (req.body.name) {
      const conflict = await Pet.findOne({
        owner: req.user.id,
        name: { $regex: new RegExp(`^${req.body.name}$`, 'i') },
        _id: { $ne: req.params.id },
      });
      if (conflict) {
        return res.status(409).json({ message: `You already have a pet named "${conflict.name}". Remove it first or use a different name.` });
      }
    }
    const pet = await Pet.findOneAndUpdate(
      { _id: req.params.id, owner: req.user.id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!pet) return res.status(404).json({ message: 'Pet not found' });
    res.json(pet);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/pets/:id — remove a pet
router.delete('/:id', ...customerOnly, async (req, res) => {
  try {
    const pet = await Pet.findOneAndDelete({ _id: req.params.id, owner: req.user.id });
    if (!pet) return res.status(404).json({ message: 'Pet not found' });
    res.json({ message: 'Pet removed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
