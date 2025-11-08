import { Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { prisma } from '../lib/prisma.js';

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, full_name } = req.body;

    // Create user in Supabase Auth
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Create profile in our database
    const profile = await prisma.profile.create({
      data: {
        id: data.user.id,
        email: data.user.email!,
        full_name
      }
    });

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
};

export const getProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const profile = await prisma.profile.findUnique({
      where: { id: userId }
    });

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json(profile);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
};

export const updateProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { full_name, phone } = req.body;

    const profile = await prisma.profile.update({
      where: { id: userId },
      data: { full_name, phone }
    });

    res.json(profile);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};
