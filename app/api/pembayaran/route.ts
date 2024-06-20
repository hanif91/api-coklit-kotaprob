import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prismadb from "@/lib/prismadb";
import { cookies } from 'next/headers'
import { verifyAuth } from '@/lib/auth';
import bcrypt from "bcrypt";

export async function POST(req: NextRequest) { 
  try {
    const body = await req.json();

    let userAuth : string = "";
    let loketAuth : string = "";
    let passAuth : string = "";

    const authHeader = req.headers.get('Authorization');
    const tokenHeader = authHeader?.replace("Bearer ","") || "";

    const isVerif  = await verifyAuth(tokenHeader);
    if (isVerif.status) {
      userAuth = isVerif.data?.user || "";
      loketAuth = isVerif.data?.kodeloket || "";  
      passAuth =  isVerif.data?.pass || "";     
    } else {
      return NextResponse.json(
        { success: false,
          rescode : 401,
          message: 'Screet Key failed' },
        { status: 401 }
      )     
    }
       // cek user verifikasi
    const isUser =  await prismadb.users.findUnique({
      where : {
        username : userAuth,
        is_user_ppob : true,
        is_active : true
      }
    });
    
    if (!isUser) {
      return NextResponse.json(
        {
          rescode : 210,
          success : false,
          message : "User Tidak Terdaftar",
          data : {
            namauser : userAuth,
            passworduser : passAuth,
            kodeloket : loketAuth
          }
        }

        ,{status : 200})  
    }

    
    const isLoket = await prismadb.loket.findUnique({
      where : {
        kodeloket : loketAuth
      }
    })
    if (!isLoket) {
      return NextResponse.json(
        {
          rescode : 210,
          success : false,
          message : "Kode Loket Tidak Terdaftar",
          data : {
            namauser : userAuth,
            passworduser : passAuth,
            kodeloket : loketAuth
          }
        }

        ,{status : 200})  
    }
    
    
    const isUserLoket = await prismadb.user_loket.findUnique({ 
      where : {
        user_id_2 : {
          user_id : isUser.id,
          loket_id : isLoket.id
        },
      }
    })
    if (!isUserLoket) {
      return NextResponse.json(
        {
          rescode : 210,
          success : false,
          message : "Kode Loket Tidak Terdaftar",
          data : {
            namauser : userAuth,
            passworduser : passAuth,
            kodeloket : loketAuth
          }
        }

        ,{status : 200})  
    } 


    const isPassCompare = await bcrypt.compare(passAuth, isUser.password);

    if (!isPassCompare) {
      return NextResponse.json(
        {
          rescode : 210,
          success : false,
          message : "Password Tidak Valid",
          data : {
            namauser : userAuth,
            passworduser : passAuth,
            kodeloket : loketAuth
          }
        }

        ,{status : 200})  
    }  
      
    if (!body.periode || !body.no_pelanggan)  {
      return NextResponse.json(
        { 
          rescode : 310,
          success: false,
          message: 'Data Body Invalid' },
        { status: 200 }
      )         
    }

    const isPelcoklit = await prismadb.pel_coklit.findUnique({
      where : {
        no_pelanggan : body.no_pelanggan || ""
      }
    })

    if (!isPelcoklit) {
      return NextResponse.json(
        {
          rescode : 211,
          success : false,
          message : "No Pelanggan Coklit Tidak Terdaftar",
          data : {
            nopel : body.no_pelanggan || ""
          }
        }

        ,{status : 200})  
    }
    const isPel = await prismadb.pelanggan.findUnique({
      where : {
        no_pelanggan :  body.no_pelanggan || "",
      }
    })
    if (!isPel) {
      return NextResponse.json(
        {
          rescode : 211,
          success : false,
          message : "No Pelanggan Tidak Terdaftar",
          data : {
            nopel : body.no_pelanggan || "" 
          }
        }

        ,{status : 200})  
    }
    if (isPel.status === 0) {
      return NextResponse.json(
        {
          rescode : 212,
          success : false,
          message : "No Pelanggan Non Aktif, Harap Ke Kantor PDAM",
          data : {
            nopel : body.no_pelanggan || "" 
          }
        }

        ,{status : 200})        
    }
    
    const datatagihan : any[] = await prismadb.$queryRaw(
      // Prisma.sql`call infotag_b_byr(${body.no_pelanggan},${userAuth})`
      
      Prisma.sql`call infotag_coklit(${body.no_pelanggan},${body.periode})`
    )
    
    // console.log(datatagihan)
    if (!datatagihan || datatagihan.length === 0) {
      return NextResponse.json(
        {
          rescode : 215,
          success : false,
          message : "Tagihan Sudah Lunas",
          data : {
            nopel : body.no_pelanggan || "" 
          }
        }

        ,{status : 200})  
    }

    const tgl : any = await prismadb.$queryRaw`Select now() as tgl`;
    let dataStsBayar =  [];

    for (const dataTag of datatagihan) {
      const dendatunggakan = parseInt(dataTag.f23)+parseInt(dataTag.f24);
      const total = parseInt(dataTag.f26);
      const materai = parseInt(dataTag.f25);
      const admin_ppob= 0; 
      const idRek = parseInt(dataTag.f0);
      const periode = dataTag.f2;
      try {
        
        const isBayar : number = await prismadb.$executeRaw`UPDATE drd SET flaglunas=1,tglbayar=${tgl[0].tgl},user_id=${isUser.id},nama_user=${isUser.nama},loket_id=${isUserLoket.loket_id},nama_loket=${isLoket.kodeloket},denda=${dendatunggakan},meterai=${materai},admin_ppob=${admin_ppob},totalrekening=${total} WHERE id=${idRek}`;
        if (isBayar === 1) {
        
          const dumpDt = {
            periode : periode,
            status : "OK"
          }
          dataStsBayar.push(dumpDt)
        } else {
          const dumpDt = {
            periode : periode,
            status : "GAGAL"
          }
          dataStsBayar.push(dumpDt);
        }

      } catch (error) {
        const dumpDt = {
          periode : periode,
          status : "ERROR"
        }   
        dataStsBayar.push(dumpDt);     
      }      
    }

    console.log(dataStsBayar)

    dataStsBayar.reverse()

  

    const result = 
    {
      rescode : 300,
      success : true,
      message : "Pembayaran Sukses",
      data : {

        no_pelanggan : isPel.no_pelanggan,
        periode :  dataStsBayar
      }
    }



    return NextResponse.json(result,{status : 200})   

  } catch (error) {
    return NextResponse.json({
      rescode : 500,
      success : false,
      message : `General Error : ${error}`
    }, { status: 500 })
  }


}
