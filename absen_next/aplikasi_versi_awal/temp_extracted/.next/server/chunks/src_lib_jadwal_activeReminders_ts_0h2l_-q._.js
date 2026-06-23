module.exports=[54524,a=>{"use strict";var e=a.i(43793);async function i(){try{let a=new Date().toLocaleDateString("sv-SE",{timeZone:"Asia/Jakarta"}),i=new Date().toLocaleTimeString("sv-SE",{timeZone:"Asia/Jakarta",hour12:!1}),r=new Intl.DateTimeFormat("id-ID",{weekday:"long",timeZone:"Asia/Jakarta"}).format(new Date);"Minggu"===r&&(r="Ahad");let n=a=>{let[e,i,r]=a.split(":").map(Number);return 3600*(e||0)+60*(i||0)+(r||0)},t=n(i),u=`
      SELECT j.jadwal_id, j.jam_mulai, j.jam_selesai, j.mata_pelajaran, j.hari,
             m.nama_kelas as kelas_nama, j.guru_id, g.nama as guru_nama, g.no_hp as guru_whatsapp
      FROM jadwal_madin j
      JOIN kelas_madin m ON j.kelas_madin_id = m.kelas_id
      LEFT JOIN guru g ON j.guru_id = g.guru_id
      WHERE j.hari = ? AND j.guru_id IS NOT NULL
    `,_=`
      SELECT j.id as jadwal_id, j.jam_mulai, j.jam_selesai, j.mata_pelajaran, j.hari,
             q.nama_kelas as kelas_nama, j.guru_id, g.nama as guru_nama, g.no_hp as guru_whatsapp
      FROM jadwal_quran j
      JOIN kelas_quran q ON j.kelas_quran_id = q.id
      LEFT JOIN guru g ON j.guru_id = g.guru_id
      WHERE j.hari = ? AND j.guru_id IS NOT NULL
    `,d=`
      SELECT jk.kegiatan_id as jadwal_id, jk.jam_mulai, jk.jam_selesai, jk.nama_kegiatan as mata_pelajaran, jk.hari,
             k.nama_kamar as kelas_nama, jk.guru_id, g.nama as guru_nama, g.no_hp as guru_whatsapp
      FROM jadwal_kegiatan jk
      JOIN kamar k ON jk.kamar_id = k.kamar_id
      LEFT JOIN guru g ON jk.guru_id = g.guru_id
      WHERE jk.hari = ? AND jk.guru_id IS NOT NULL
    `,[l]=await e.default.execute(u,[r]),[m]=await e.default.execute(_,[r]),[j]=await e.default.execute(d,[r]),g=[],s=(a,e)=>{for(let i of a){let a=n(i.jam_mulai),r=n(i.jam_selesai),u=a-1800,_=r+10800;t>=u&&t<=_&&g.push({jadwal_id:i.jadwal_id,tipe:e,mata_pelajaran:i.mata_pelajaran||"",kelas_nama:i.kelas_nama||"",jam_mulai:i.jam_mulai,jam_selesai:i.jam_selesai,guru_id:i.guru_id,guru_nama:i.guru_nama||"Tanpa Nama",guru_whatsapp:i.guru_whatsapp||"",hari:i.hari})}};if(s(l,"madin"),s(m,"quran"),s(j,"kamar"),0===g.length)return[];let k=g.filter(a=>"madin"===a.tipe).map(a=>a.jadwal_id),w=g.filter(a=>"quran"===a.tipe).map(a=>a.jadwal_id),p=g.filter(a=>"kamar"===a.tipe).map(a=>a.jadwal_id),E=new Set,N=new Set,h=new Set;if(k.length>0){let[i]=await e.default.query(`SELECT DISTINCT jadwal_madin_id FROM absensi WHERE tanggal = ? AND jadwal_madin_id IN (${k.join(",")})`,[a]);i.forEach(a=>E.add(a.jadwal_madin_id))}if(w.length>0){let[i]=await e.default.query(`SELECT DISTINCT jadwal_quran_id FROM absensi_quran WHERE tanggal = ? AND jadwal_quran_id IN (${w.join(",")})`,[a]);i.forEach(a=>N.add(a.jadwal_quran_id))}if(p.length>0){let[i]=await e.default.query(`SELECT DISTINCT kegiatan_id FROM absensi_kegiatan WHERE tanggal = ? AND kegiatan_id IN (${p.join(",")})`,[a]);i.forEach(a=>h.add(a.kegiatan_id))}return g.filter(a=>"madin"===a.tipe?!E.has(a.jadwal_id):"quran"===a.tipe?!N.has(a.jadwal_id):"kamar"!==a.tipe||!h.has(a.jadwal_id))}catch(a){return console.error("Error calculating active pending reminders:",a),[]}}a.s(["getActivePendingReminders",0,i])}];

//# sourceMappingURL=src_lib_jadwal_activeReminders_ts_0h2l_-q._.js.map