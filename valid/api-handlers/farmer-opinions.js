import { createHash, randomUUID } from 'node:crypto';
import dbConnect from '../lib/mongodb.js';
import { BusinessRecord } from '../lib/models.js';
import { authorize } from '../lib/auth.js';
import { ADMIN_ROLES } from '../shared/roles.js';
import { normalizePhone } from '../lib/auth.js';
import { readImageDataUrl } from '../lib/imageData.js';

function normalizeText(value, maxLength) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function publicOpinion(record) {
  const opinion = record.data || {};
  return {
    id: String(record.recordId),
    farmerName: opinion.showNamePublicly ? opinion.farmerName : '',
    district: opinion.district || '',
    opinion: opinion.opinion || '',
    photoDataUrl: opinion.photo?.dataUrl || '',
    approvedAt: opinion.approvedAt || null,
    isSavedToGallery: Boolean(opinion.isSavedToGallery)
  };
}

export default async function handler(req, res) {
  if (!['GET', 'POST', 'PATCH'].includes(req.method)) return res.status(405).json({ error: 'Method Not Allowed' });
  if (!await dbConnect()) return res.status(503).json({ error: 'MongoDB is not configured.' });

  try {
    if (req.method === 'GET' && req.query?.queue === '1') {
      const user = await authorize(req, res, ADMIN_ROLES);
      if (!user) return;
      const pending = await BusinessRecord.find({
        type: 'farmerOpinions',
        'data.status': 'pending_approval'
      }).sort({ createdAt: 1 }).lean();
      return res.status(200).json(pending.map((record) => ({
        id: record.recordId,
        ...record.data,
        createdAt: record.createdAt
      })));
    }

    if (req.method === 'GET') {
      const now = new Date();
      await BusinessRecord.updateMany(
        {
          type: 'farmerOpinions',
          'data.status': 'approved',
          'data.isSavedToGallery': { $ne: true },
          'data.archiveAt': { $lte: now }
        },
        { $set: { 'data.isSavedToGallery': true, 'data.archivedAt': now } }
      );
      const [active, gallery] = await Promise.all([
        BusinessRecord.find({
          type: 'farmerOpinions',
          'data.status': 'approved',
          'data.activeUntil': { $gt: now }
        }).sort({ 'data.approvedAt': -1 }).limit(20).lean(),
        BusinessRecord.find({
          type: 'farmerOpinions',
          'data.status': 'approved',
          'data.isSavedToGallery': true
        }).sort({ 'data.approvedAt': -1 }).limit(24).lean()
      ]);
      return res.status(200).json({
        active: active.map(publicOpinion),
        gallery: gallery.map(publicOpinion)
      });
    }

    if (req.method === 'POST') {
      const farmerName = normalizeText(req.body?.farmerName, 100);
      const district = normalizeText(req.body?.district, 80);
      const opinion = normalizeText(req.body?.opinion, 2000);
      const phone = normalizePhone(req.body?.phone);
      const showNamePublicly = req.body?.showNamePublicly === true;
      if (farmerName.length < 2 || district.length < 2 || opinion.length < 10) {
        return res.status(400).json({ error: 'নাম, জেলা ও কমপক্ষে ১০ অক্ষরের মতামত দিন।' });
      }
      if (phone && (phone.length < 10 || phone.length > 13)) {
        return res.status(400).json({ error: 'ফোন নম্বরটি সঠিক নয়।' });
      }
      let photo = null;
      if (req.body?.photoDataUrl) {
        photo = readImageDataUrl(req.body.photoDataUrl);
        if (!photo) return res.status(400).json({ error: 'ছবি JPEG, PNG বা WebP হতে হবে এবং ১.৫ এমবির মধ্যে রাখতে হবে।' });
      }
      const id = `FOP-${randomUUID()}`;
      const identity = phone || `${district.toLocaleLowerCase()}|${farmerName.toLocaleLowerCase()}`;
      const data = {
        status: 'pending_approval',
        farmerName,
        district,
        opinion,
        farmerKey: createHash('sha256').update(identity).digest('hex'),
        showNamePublicly,
        photo: photo ? { dataUrl: photo.dataUrl, mimeType: photo.mimeType } : null,
        submittedAt: new Date()
      };
      await BusinessRecord.create({ type: 'farmerOpinions', recordId: id, data });
      return res.status(201).json({ message: 'আপনার মতামত অনুমোদনের জন্য জমা হয়েছে।' });
    }

    const user = await authorize(req, res, ADMIN_ROLES);
    if (!user) return;
    const id = String(req.body?.id || '').trim();
    const decision = String(req.body?.decision || '');
    if (!id || !['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ error: 'সঠিক অনুমোদন নির্বাচন করুন।' });
    }
    if (decision === 'approved') {
      const approvedAt = new Date();
      const saved = await BusinessRecord.findOneAndUpdate(
        { type: 'farmerOpinions', recordId: id, 'data.status': 'pending_approval' },
        {
          $set: {
            'data.status': 'approved',
            'data.approvedAt': approvedAt,
            'data.archiveAt': new Date(approvedAt.valueOf() + 3 * 24 * 60 * 60 * 1000),
            'data.activeUntil': new Date(approvedAt.valueOf() + 7 * 24 * 60 * 60 * 1000),
            'data.approvedBy': user.name,
            'data.approvedByRole': user.role,
            'data.isSavedToGallery': false
          }
        },
        { new: true }
      ).lean();
      if (!saved) return res.status(409).json({ error: 'অপেক্ষমাণ মতামতটি পাওয়া যায়নি।' });
      return res.status(200).json({ message: 'মতামত অনুমোদিত হয়েছে।' });
    }

    const removed = await BusinessRecord.deleteOne({
      type: 'farmerOpinions',
      recordId: id,
      'data.status': 'pending_approval'
    });
    if (removed.deletedCount !== 1) return res.status(409).json({ error: 'অপেক্ষমাণ মতামতটি পাওয়া যায়নি।' });
    return res.status(200).json({ message: 'প্রত্যাখ্যাত মতামত ও অপেক্ষমাণ ছবির রেফারেন্স সরানো হয়েছে।' });
  } catch (error) {
    console.error('Farmer opinion request failed:', error);
    return res.status(500).json({ error: 'মতামতের অনুরোধ সম্পন্ন করা যায়নি।' });
  }
}
